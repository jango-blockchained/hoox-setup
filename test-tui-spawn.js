import { WorkerService } from "./src/tui/services/WorkerService.js";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const service = new WorkerService(
  { d1: { name: "D1 Worker", status: "stopped", port: 8787, extraArgs: "--local" } },
  () => {},
  () => {},
  (msg) => console.log(msg),
  spawn,
  execPromise
);

service.startWorker("d1").then(() => {
  console.log("Started. Processes:", Object.keys(service.workerProcesses));
  setTimeout(() => {
    service.stopWorker("d1").then(() => {
      console.log("Stopped.");
      process.exit(0);
    });
  }, 2000);
}).catch(console.error);
