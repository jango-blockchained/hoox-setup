import path from "path";
// Remove direct imports
// import { spawn } from "child_process";
// import { exec } from "child_process";
// import { promisify } from "util";

// const _execPromise = promisify(exec); // Remove promisify here

export class WorkerService {
  constructor(
    initialWorkers,
    setWorkers,
    setLogs,
    setStatusMessage,
    spawnFn,
    execFn
  ) {
    // Add initialWorkers
    this.workers = { ...initialWorkers }; // Store initial config internally
    this.setWorkers = setWorkers;
    this.setLogs = setLogs;
    this.setStatusMessage = setStatusMessage;
    this.spawnFn = spawnFn; // Store injected functions
    this.execFn = execFn; // Store injected functions
    this.workerProcesses = {};
    this.logBuffers = {
      d1: [],
      trade: [],
      webhook: [],
      telegram: [],
      "home-assistant": [],
      "web3-wallet": [],
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

    // Update worker status in internal state AND call external setter
    this.workers[workerId].status = "starting";
    this.updateWorkerStatus(workerId, "starting"); // Call external setter
    this.setStatusMessage(`Starting ${workerId} worker...`);

    try {
      const worker = this.getWorkerConfig(workerId); // Use internal getter
      if (!worker) {
        // Add check in case workerId is invalid
        throw new Error(`Worker configuration not found for ${workerId}`);
      }
      const workingDir = path.resolve(process.cwd(), `${workerId}-worker`);

      // Start the process using injected function
      const childProcess = this.spawnFn(
        "bun",
        [
          "run",
          "dev",
          "--",
          `--port`,
          worker.port.toString(),
          ...worker.extraArgs.split(" ").filter(Boolean),
        ],
        {
          cwd: workingDir,
          shell: true,
        }
      );

      // Store the process
      this.workerProcesses[workerId] = childProcess;

      // Handle stdout
      childProcess.stdout.on("data", (data) => {
        const logData = data.toString();
        this.addToLogs(workerId, logData);
      });

      // Handle stderr
      childProcess.stderr.on("data", (data) => {
        const logData = data.toString();
        this.addToLogs(workerId, logData);
      });

      // Handle exit
      childProcess.on("exit", (code) => {
        this.logBuffers[workerId].push(`Process exited with code ${code}`);
        // Update internal state and call external setter on exit
        this.workers[workerId].status = "stopped";
        this.updateWorkerStatus(workerId, "stopped");
        delete this.workerProcesses[workerId];
      });

      // Wait a bit for process to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update internal state and call external setter
      this.workers[workerId].status = "running";
      this.updateWorkerStatus(workerId, "running");
      this.setStatusMessage(
        `${workerId} worker started on port ${worker.port}`
      );
    } catch (error) {
      // Update internal state and call external setter
      if (this.workers[workerId]) {
        // Check if worker exists before updating
        this.workers[workerId].status = "error";
      }
      this.updateWorkerStatus(workerId, "error");
      this.setStatusMessage(
        `Error starting ${workerId} worker: ${error.message}`
      );
      this.addToLogs(workerId, `Error: ${error.message}`);
    }
  }

  /**
   * Stop a worker by its ID
   */
  stopWorker(workerId) {
    // Make it return a Promise explicitly
    return new Promise((resolve, reject) => {
      const process = this.workerProcesses[workerId];
      if (!process) {
        this.setStatusMessage(`${workerId} worker is not running`);
        resolve(); // Resolve immediately if not running
        return;
      }

      // Update internal state and call external setter
      this.workers[workerId].status = "stopping";
      this.updateWorkerStatus(workerId, "stopping");
      this.setStatusMessage(`Stopping ${workerId} worker...`);

      let killTimeout;
      const exitHandler = () => {
        clearTimeout(killTimeout);
        // Update internal state and call external setter on exit
        if (this.workers[workerId]) {
          // Check if worker config still exists
          this.workers[workerId].status = "stopped";
        }
        delete this.workerProcesses[workerId]; // Ensure delete happens
        this.updateWorkerStatus(workerId, "stopped");
        this.setStatusMessage(`${workerId} worker stopped`);
        resolve(); // Resolve the promise AFTER cleanup
      };

      const errorHandler = (error) => {
        clearTimeout(killTimeout);
        // Update internal state and call external setter
        if (this.workers[workerId]) {
          // Check if worker exists before updating
          this.workers[workerId].status = "error";
        }
        this.updateWorkerStatus(workerId, "error");
        this.setStatusMessage(
          `Error stopping ${workerId} worker: ${error.message}`
        );
        reject(error); // Reject the promise on error
      };

      // Add listeners ONCE
      process.once("exit", exitHandler);
      process.once("error", errorHandler);

      try {
        // Try to gracefully terminate
        process.kill("SIGTERM");

        // Wait for process to exit, or force kill after timeout
        killTimeout = setTimeout(() => {
          if (this.workerProcesses[workerId]) {
            // Before force kill, remove listeners to prevent duplicate resolves/rejects
            process.removeListener("exit", exitHandler);
            process.removeListener("error", errorHandler);
            try {
              process.kill("SIGKILL");
              // Manually trigger cleanup as exit event might not fire after SIGKILL
              exitHandler();
            } catch (killError) {
              errorHandler(killError);
            }
          }
        }, 5000);
      } catch (error) {
        // Handle immediate kill errors (e.g., process already exited)
        errorHandler(error);
      }
    });
  }

  /**
   * Restart a worker by its ID
   */
  async restartWorker(workerId) {
    this.setStatusMessage(`Restarting ${workerId} worker...`);

    // Stop the worker first
    await this.stopWorker(workerId);

    // Wait for process to fully stop
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start the worker again
    await this.startWorker(workerId);
  }

  /**
   * Start all workers
   */
  async startAllWorkers() {
    this.setStatusMessage("Starting all workers...");

    // Start workers in specific order
    await this.startWorker("d1");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.startWorker("trade");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.startWorker("telegram");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.startWorker("webhook");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start new workers
    await this.startWorker("home-assistant");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.startWorker("web3-wallet");

    this.setStatusMessage("All workers started");
  }

  /**
   * Stop all workers
   */
  async stopAllWorkers() {
    this.setStatusMessage("Stopping all workers...");

    // Stop new workers first
    await this.stopWorker("web3-wallet");
    await this.stopWorker("home-assistant");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // First stop the webhook receiver (entry point)
    await this.stopWorker("webhook");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Then stop the other workers
    await this.stopWorker("telegram");
    await this.stopWorker("trade");
    await this.stopWorker("d1");

    this.setStatusMessage("All workers stopped");
  }

  /**
   * Restart all workers
   */
  async restartAllWorkers() {
    await this.stopAllWorkers();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.startAllWorkers();
  }

  /**
   * Check status of all workers using ps aux
   */
  async checkAllStatus() {
    try {
      // Use injected exec function
      const { stdout } = await this.execFn(
        "ps aux | grep 'bun run dev --' | grep -v grep"
      );

      // Process the ps output to determine actual running state
      const psLines = stdout.split("\n");
      const runningPortPids = psLines
        .map((line) => {
          const match = line.match(/\s+(\d+)\s+.*bun run dev -- --port (\d+)/);
          return match
            ? { pid: parseInt(match[1]), port: parseInt(match[2]) }
            : null;
        })
        .filter(Boolean);
      const runningPortMap = runningPortPids.reduce((map, p) => {
        map[p.port] = p.pid;
        return map;
      }, {});

      // Update worker statuses based on ps output vs internal state
      this.setWorkers((prevWorkers) => {
        const updatedWorkers = { ...prevWorkers }; // Start with previous state

        for (const workerId in updatedWorkers) {
          const workerConfig = this.workers[workerId]; // Use internal config for port info
          if (!workerConfig) continue;

          const isRunningInPs = runningPortMap[workerConfig.port] !== undefined;
          const currentProcessInMemory = this.workerProcesses[workerId];

          if (isRunningInPs) {
            updatedWorkers[workerId].status = "running";
            if (!currentProcessInMemory) {
              // Discrepancy: ps says running, but we have no process object.
              // Might happen if TUI restarted but worker didn't.
              // Log this, but trust ps for status.
              this.addToLogs(
                workerId,
                `[checkAllStatus] Detected running process via ps (PID ${runningPortMap[workerConfig.port]}) but no internal handle exists.`
              );
            }
          } else {
            // Not running according to ps
            updatedWorkers[workerId].status = "stopped";
            if (currentProcessInMemory) {
              // Discrepancy: ps says stopped, but we still have a process object.
              // The 'exit' event likely hasn't fired or was missed.
              this.addToLogs(
                workerId,
                `[checkAllStatus] Internal process handle exists but process not found via ps. Forcing cleanup.`
              );
              // Force cleanup of the potentially orphaned process handle
              currentProcessInMemory.removeAllListeners(); // Prevent memory leaks
              delete this.workerProcesses[workerId];
            }
          }
        }
        return updatedWorkers;
      });

      this.setStatusMessage("Worker status refreshed via ps aux.");
    } catch (error) {
      this.setStatusMessage(`Error checking worker status: ${error.message}`);
    }
  }

  /**
   * Update the status of a worker
   */
  updateWorkerStatus(workerId, status) {
    this.setWorkers((prevWorkers) => ({
      ...prevWorkers,
      [workerId]: {
        ...prevWorkers[workerId],
        status,
      },
    }));
  }

  /**
   * Add log data to a worker's logs
   */
  addToLogs(workerId, data) {
    // Add to buffer
    const lines = data.split("\n").filter(Boolean);
    if (!this.logBuffers[workerId]) {
      this.logBuffers[workerId] = [];
    }
    this.logBuffers[workerId].push(...lines);

    // Keep only last 500 lines
    if (this.logBuffers[workerId].length > 500) {
      this.logBuffers[workerId] = this.logBuffers[workerId].slice(-500);
    }

    // Update logs state
    this.setLogs((prevLogs) => ({
      ...prevLogs,
      [workerId]: this.logBuffers[workerId],
    }));
  }

  /**
   * Get worker configuration (now synchronous)
   */
  getWorkerConfig(workerId) {
    return this.workers[workerId]; // Return from internal state
  }
}
