import path from "node:path";
import { spawn, exec, ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execPromise = promisify(exec);

export interface WorkerConfig {
  name: string;
  port: number;
  extraArgs: string;
  status: "stopped" | "starting" | "running" | "stopping" | "error";
}

export class WorkerService {
  public workers: Record<string, WorkerConfig>;
  private setWorkers: (
    updater: (
      prev: Record<string, WorkerConfig>
    ) => Record<string, WorkerConfig>
  ) => void;
  private setLogs: (
    updater: (prev: Record<string, string[]>) => Record<string, string[]>
  ) => void;
  private setStatusMessage: (msg: string) => void;
  private workerProcesses: Record<string, ChildProcess> = {};
  private logBuffers: Record<string, string[]> = {};

  constructor(
    initialWorkers: Record<string, WorkerConfig>,
    setWorkers: (
      updater: (
        prev: Record<string, WorkerConfig>
      ) => Record<string, WorkerConfig>
    ) => void,
    setLogs: (
      updater: (prev: Record<string, string[]>) => Record<string, string[]>
    ) => void,
    setStatusMessage: (msg: string) => void
  ) {
    this.workers = { ...initialWorkers };
    this.setWorkers = setWorkers;
    this.setLogs = setLogs;
    this.setStatusMessage = setStatusMessage;

    for (const id of Object.keys(initialWorkers)) {
      this.logBuffers[id] = [];
    }
  }

  async startWorker(workerId: string) {
    if (this.workerProcesses[workerId]) {
      this.setStatusMessage(`${workerId} worker is already running`);
      return;
    }

    this.workers[workerId].status = "starting";
    this.updateWorkerStatus(workerId, "starting");
    this.setStatusMessage(`Starting ${workerId} worker...`);

    try {
      const worker = this.getWorkerConfig(workerId);
      if (!worker)
        throw new Error(`Worker configuration not found for ${workerId}`);

      let dirName = `${workerId}-worker`;
      if (workerId === "webhook") dirName = "hoox";

      const workingDir = path.resolve(
        process.cwd(),
        "..",
        "..",
        "workers",
        dirName
      );

      const childProcess = spawn(
        process.execPath,
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
          env: process.env,
        }
      );

      this.workerProcesses[workerId] = childProcess;

      childProcess.stdout?.on("data", (data) => {
        this.addToLogs(workerId, data.toString());
      });

      childProcess.stderr?.on("data", (data) => {
        this.addToLogs(workerId, data.toString());
      });

      childProcess.on("exit", (code) => {
        this.logBuffers[workerId].push(`Process exited with code ${code}`);
        if (this.workers[workerId]) {
          this.workers[workerId].status = "stopped";
          this.updateWorkerStatus(workerId, "stopped");
        }
        delete this.workerProcesses[workerId];
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.workers[workerId].status = "running";
      this.updateWorkerStatus(workerId, "running");
      this.setStatusMessage(
        `${workerId} worker started on port ${worker.port}`
      );
    } catch (error: any) {
      if (this.workers[workerId]) this.workers[workerId].status = "error";
      this.updateWorkerStatus(workerId, "error");
      this.setStatusMessage(
        `Error starting ${workerId} worker: ${error.message}`
      );
      this.addToLogs(workerId, `Error: ${error.message}`);
    }
  }

  stopWorker(workerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = this.workerProcesses[workerId];
      if (!childProcess) {
        this.setStatusMessage(`${workerId} worker is not running`);
        resolve();
        return;
      }

      this.workers[workerId].status = "stopping";
      this.updateWorkerStatus(workerId, "stopping");
      this.setStatusMessage(`Stopping ${workerId} worker...`);

      let killTimeout: NodeJS.Timeout;
      const exitHandler = () => {
        clearTimeout(killTimeout);
        if (this.workers[workerId]) this.workers[workerId].status = "stopped";
        delete this.workerProcesses[workerId];
        this.updateWorkerStatus(workerId, "stopped");
        this.setStatusMessage(`${workerId} worker stopped`);
        resolve();
      };

      const errorHandler = (error: any) => {
        clearTimeout(killTimeout);
        if (this.workers[workerId]) this.workers[workerId].status = "error";
        this.updateWorkerStatus(workerId, "error");
        this.setStatusMessage(
          `Error stopping ${workerId} worker: ${error.message}`
        );
        reject(error);
      };

      childProcess.once("exit", exitHandler);
      childProcess.once("error", errorHandler);

      try {
        childProcess.kill("SIGTERM");
        killTimeout = setTimeout(() => {
          if (this.workerProcesses[workerId]) {
            childProcess.removeListener("exit", exitHandler);
            childProcess.removeListener("error", errorHandler);
            try {
              childProcess.kill("SIGKILL");
              exitHandler();
            } catch (killError) {
              errorHandler(killError);
            }
          }
        }, 5000);
      } catch (error) {
        errorHandler(error);
      }
    });
  }

  async restartWorker(workerId: string) {
    this.setStatusMessage(`Restarting ${workerId} worker...`);
    await this.stopWorker(workerId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.startWorker(workerId);
  }

  async startAllWorkers() {
    this.setStatusMessage("Starting all workers...");
    for (const workerId of Object.keys(this.workers)) {
      await this.startWorker(workerId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.setStatusMessage("All workers started");
  }

  async stopAllWorkers() {
    this.setStatusMessage("Stopping all workers...");
    const keys = Object.keys(this.workers).reverse();
    for (const workerId of keys) {
      await this.stopWorker(workerId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.setStatusMessage("All workers stopped");
  }

  async restartAllWorkers() {
    await this.stopAllWorkers();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.startAllWorkers();
  }

  async checkAllStatus() {
    try {
      const { stdout } = await execPromise(
        "ps aux | grep 'bun run dev --' | grep -v grep"
      );
      const psLines = stdout.split("\n");
      const runningPortMap: Record<number, number> = {};

      psLines.forEach((line) => {
        const match = line.match(/\s+(\d+)\s+.*bun run dev -- --port (\d+)/);
        if (match) runningPortMap[parseInt(match[2])] = parseInt(match[1]);
      });

      this.setWorkers((prevWorkers) => {
        const updatedWorkers = { ...prevWorkers };
        for (const workerId in updatedWorkers) {
          const workerConfig = this.workers[workerId];
          if (!workerConfig) continue;

          const isRunningInPs = runningPortMap[workerConfig.port] !== undefined;
          const currentProcessInMemory = this.workerProcesses[workerId];

          if (isRunningInPs) {
            updatedWorkers[workerId].status = "running";
          } else {
            updatedWorkers[workerId].status = "stopped";
            if (currentProcessInMemory) {
              currentProcessInMemory.removeAllListeners();
              delete this.workerProcesses[workerId];
            }
          }
        }
        return updatedWorkers;
      });
      this.setStatusMessage("Worker status refreshed via ps aux.");
    } catch (error: any) {
      this.setStatusMessage(`Error checking worker status: ${error.message}`);
    }
  }

  private updateWorkerStatus(workerId: string, status: WorkerConfig["status"]) {
    this.setWorkers((prev) => ({
      ...prev,
      [workerId]: { ...prev[workerId], status },
    }));
  }

  private addToLogs(workerId: string, data: string) {
    const lines = data.split("\n").filter(Boolean);
    if (!this.logBuffers[workerId]) this.logBuffers[workerId] = [];

    this.logBuffers[workerId].push(...lines);
    if (this.logBuffers[workerId].length > 500) {
      this.logBuffers[workerId] = this.logBuffers[workerId].slice(-500);
    }

    this.setLogs((prev) => ({
      ...prev,
      [workerId]: [...this.logBuffers[workerId]],
    }));
  }

  private getWorkerConfig(workerId: string) {
    return this.workers[workerId];
  }
}
