import { spawn } from 'child_process';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class WorkerService {
    constructor(setWorkers, setLogs, setStatusMessage) {
        this.setWorkers = setWorkers;
        this.setLogs = setLogs;
        this.setStatusMessage = setStatusMessage;
        this.workerProcesses = {};
        this.logBuffers = {
            d1: [],
            trade: [],
            webhook: [],
            telegram: []
        };
    }

    /**
     * Start a worker by its ID
     */
    async startWorker(workerId) {
        // Don't start if already running
        if (this.workerProcesses[workerId]) {
            this.setStatusMessage(`${workerId} worker is already running`);
            return;
        }

        // Update worker status to starting
        this.updateWorkerStatus(workerId, 'starting');
        this.setStatusMessage(`Starting ${workerId} worker...`);

        try {
            const worker = await this.getWorkerConfig(workerId);
            const workingDir = path.resolve(process.cwd(), `${workerId}-worker`);

            // Start the process
            const childProcess = spawn('bun', ['run', 'dev', '--', `--port`, worker.port.toString(), ...worker.extraArgs.split(' ').filter(Boolean)], {
                cwd: workingDir,
                shell: true
            });

            // Store the process
            this.workerProcesses[workerId] = childProcess;

            // Handle stdout
            childProcess.stdout.on('data', (data) => {
                const logData = data.toString();
                this.addToLogs(workerId, logData);
            });

            // Handle stderr
            childProcess.stderr.on('data', (data) => {
                const logData = data.toString();
                this.addToLogs(workerId, logData);
            });

            // Handle exit
            childProcess.on('exit', (code) => {
                this.logBuffers[workerId].push(`Process exited with code ${code}`);
                this.updateWorkerStatus(workerId, 'stopped');
                delete this.workerProcesses[workerId];
            });

            // Wait a bit for process to start
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.updateWorkerStatus(workerId, 'running');
            this.setStatusMessage(`${workerId} worker started on port ${worker.port}`);
        } catch (error) {
            this.updateWorkerStatus(workerId, 'error');
            this.setStatusMessage(`Error starting ${workerId} worker: ${error.message}`);
            this.addToLogs(workerId, `Error: ${error.message}`);
        }
    }

    /**
     * Stop a worker by its ID
     */
    async stopWorker(workerId) {
        const process = this.workerProcesses[workerId];
        if (!process) {
            this.setStatusMessage(`${workerId} worker is not running`);
            return;
        }

        this.updateWorkerStatus(workerId, 'stopping');
        this.setStatusMessage(`Stopping ${workerId} worker...`);

        try {
            // Try to gracefully terminate
            process.kill('SIGTERM');

            // Wait for process to exit, or force kill after timeout
            const killTimeout = setTimeout(() => {
                if (this.workerProcesses[workerId]) {
                    process.kill('SIGKILL');
                }
            }, 5000);

            // Clean up when process exits
            process.on('exit', () => {
                clearTimeout(killTimeout);
                delete this.workerProcesses[workerId];
                this.updateWorkerStatus(workerId, 'stopped');
                this.setStatusMessage(`${workerId} worker stopped`);
            });
        } catch (error) {
            this.updateWorkerStatus(workerId, 'error');
            this.setStatusMessage(`Error stopping ${workerId} worker: ${error.message}`);
        }
    }

    /**
     * Restart a worker by its ID
     */
    async restartWorker(workerId) {
        this.setStatusMessage(`Restarting ${workerId} worker...`);

        // Stop the worker first
        await this.stopWorker(workerId);

        // Wait for process to fully stop
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start the worker again
        await this.startWorker(workerId);
    }

    /**
     * Start all workers
     */
    async startAllWorkers() {
        this.setStatusMessage('Starting all workers...');

        // Start workers in specific order
        await this.startWorker('d1');
        await new Promise(resolve => setTimeout(resolve, 1000));

        await this.startWorker('trade');
        await new Promise(resolve => setTimeout(resolve, 1000));

        await this.startWorker('telegram');
        await new Promise(resolve => setTimeout(resolve, 1000));

        await this.startWorker('webhook');

        this.setStatusMessage('All workers started');
    }

    /**
     * Stop all workers
     */
    async stopAllWorkers() {
        this.setStatusMessage('Stopping all workers...');

        // First stop the webhook receiver (entry point)
        await this.stopWorker('webhook');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Then stop the other workers
        await this.stopWorker('telegram');
        await this.stopWorker('trade');
        await this.stopWorker('d1');

        this.setStatusMessage('All workers stopped');
    }

    /**
     * Restart all workers
     */
    async restartAllWorkers() {
        await this.stopAllWorkers();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.startAllWorkers();
    }

    /**
     * Check status of all workers based on internal tracking.
     * Note: This doesn't verify if the process is *actually* healthy,
     * only if this service believes it's running.
     */
    async checkAllStatus() {
        // No external command needed now. Status is primarily tracked internally.
        // We can trigger an update to ensure UI reflects the internal state.
        this.setWorkers(prevWorkers => {
             const updatedWorkers = { ...prevWorkers };
             for (const workerId in updatedWorkers) {
                 const processExists = !!this.workerProcesses[workerId];
                 const currentStatus = updatedWorkers[workerId].status;

                 if (processExists && currentStatus !== 'running' && currentStatus !== 'starting' && currentStatus !== 'stopping') {
                     // If we have a process but status isn't running/starting/stopping, mark as running
                     // This handles cases where the initial state might be inaccurate
                      updatedWorkers[workerId].status = 'running';
                 } else if (!processExists && (currentStatus === 'running' || currentStatus === 'starting' || currentStatus === 'stopping')) {
                     // If we *don't* have a process but status is running/starting/stopping, mark as stopped
                     // This handles cases where the process died unexpectedly without triggering 'exit'
                      updatedWorkers[workerId].status = 'stopped';
                 }
                 // Otherwise, trust the existing status (stopped, error, starting, stopping)
             }
             return updatedWorkers;
         });
         this.setStatusMessage("Worker status refreshed (internal check).");
    }

    /**
     * Update the status of a worker
     */
    updateWorkerStatus(workerId, status) {
        this.setWorkers(prevWorkers => ({
            ...prevWorkers,
            [workerId]: {
                ...prevWorkers[workerId],
                status
            }
        }));
    }

    /**
     * Add log data to a worker's logs
     */
    addToLogs(workerId, data) {
        // Add to buffer
        const lines = data.split('\n').filter(Boolean);
        this.logBuffers[workerId].push(...lines);

        // Keep only last 500 lines
        if (this.logBuffers[workerId].length > 500) {
            this.logBuffers[workerId] = this.logBuffers[workerId].slice(-500);
        }

        // Update logs state
        this.setLogs(prevLogs => ({
            ...prevLogs,
            [workerId]: this.logBuffers[workerId]
        }));
    }

    /**
     * Get worker configuration
     */
    async getWorkerConfig(workerId) {
        return this.setWorkers(prevWorkers => prevWorkers)[workerId];
    }
} 