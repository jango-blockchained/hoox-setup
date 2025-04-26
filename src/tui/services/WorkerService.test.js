import { jest } from "@jest/globals";
import { EventEmitter } from "events";

// Mock child_process
const mockSpawnInstance = new EventEmitter();
mockSpawnInstance.stdout = new EventEmitter();
mockSpawnInstance.stderr = new EventEmitter();
mockSpawnInstance.kill = jest.fn();

const mockSpawn = jest.fn(() => mockSpawnInstance);
const mockExec = jest.fn();

jest.unstable_mockModule("child_process", () => ({
  spawn: mockSpawn,
  exec: mockExec,
}));

jest.unstable_mockModule("util", () => ({
  promisify: jest.fn((fn) => fn), // Mock promisify to just return the function
}));

// Mock path (optional, but good practice if paths get complex)
// jest.mock('path', () => ({
//     ...jest.requireActual('path'),
//     resolve: jest.fn((...args) => args.join('/')), // Simple mock
// }));

describe("WorkerService", () => {
  let WorkerService;
  let mockSetWorkers;
  let mockSetLogs;
  let mockSetStatusMessage;

  beforeAll(() => {
    // Use fake timers to control setTimeout
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    // Reset mocks and modules before each test
    jest.clearAllMocks();
    jest.resetModules();

    // Mock constructor dependencies
    mockSetWorkers = jest.fn();
    mockSetLogs = jest.fn();
    mockSetStatusMessage = jest.fn();

    // Dynamically import the service AFTER mocks are set up
    const module = await import("./WorkerService.js");
    WorkerService = module.WorkerService; // Assuming WorkerService is a named export
  });

  afterAll(() => {
    // Restore real timers after all tests
    jest.useRealTimers();
  });

  it("should construct correctly", () => {
    const service = new WorkerService(
      mockSetWorkers,
      mockSetLogs,
      mockSetStatusMessage
    );
    expect(service).toBeDefined();
    expect(service.setWorkers).toBe(mockSetWorkers);
    expect(service.setLogs).toBe(mockSetLogs);
    expect(service.setStatusMessage).toBe(mockSetStatusMessage);
    expect(service.workerProcesses).toEqual({});
  });

  describe("startWorker", () => {
    it("should spawn a worker process and update status", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      const workerId = "d1";

      // Start the worker
      const startPromise = service.startWorker(workerId);

      // Expectations during startup
      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `Starting ${workerId} worker...`
      );
      expect(mockSpawn).toHaveBeenCalledWith(
        "bun",
        ["run", "dev", "--", "--port", "8787", "--local"], // Example args for d1
        expect.objectContaining({
          cwd: expect.stringContaining(`${workerId}-worker`),
          shell: true,
        })
      );

      // Simulate stdout/stderr
      mockSpawnInstance.stdout.emit("data", "Log line 1\n");
      mockSpawnInstance.stderr.emit("data", "Error line 1\n");

      // Advance timer for the startup delay
      jest.advanceTimersByTime(1000);

      await startPromise; // Wait for the start function to complete

      // Final expectations
      expect(mockSetLogs).toHaveBeenCalledWith(expect.any(Function));
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `${workerId} worker started on port 8787`
      );
      expect(service.workerProcesses[workerId]).toBe(mockSpawnInstance);
      // Add more assertions on mockSetWorkers/mockSetLogs calls if needed
    });

    it("should handle spawn error", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      const workerId = "trade";
      const errorMessage = "Spawn failed";

      mockSpawn.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await service.startWorker(workerId);

      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function)); // For 'starting'
      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function)); // For 'error'
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `Error starting ${workerId} worker: ${errorMessage}`
      );
      expect(mockSetLogs).toHaveBeenCalledWith(expect.any(Function));
      expect(service.workerProcesses[workerId]).toBeUndefined();
    });
  });

  describe("stopWorker", () => {
    it("should kill a running process and update status", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      const workerId = "webhook";

      // Simulate a running process
      service.workerProcesses[workerId] = mockSpawnInstance;

      // Stop the worker
      const stopPromise = service.stopWorker(workerId);

      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function)); // stopping
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `Stopping ${workerId} worker...`
      );
      expect(mockSpawnInstance.kill).toHaveBeenCalledWith("SIGTERM");

      // Simulate the process exiting
      mockSpawnInstance.emit("exit", 0);

      await stopPromise;

      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function)); // stopped
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `${workerId} worker stopped`
      );
      expect(service.workerProcesses[workerId]).toBeUndefined();
    });

    it("should force kill if process does not exit", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      const workerId = "telegram";
      service.workerProcesses[workerId] = mockSpawnInstance;

      const stopPromise = service.stopWorker(workerId);

      expect(mockSpawnInstance.kill).toHaveBeenCalledWith("SIGTERM");

      // Advance timer past the timeout
      jest.advanceTimersByTime(5000);

      expect(mockSpawnInstance.kill).toHaveBeenCalledWith("SIGKILL");

      // Simulate exit after force kill
      mockSpawnInstance.emit("exit", null);

      await stopPromise;
      expect(service.workerProcesses[workerId]).toBeUndefined();
    });
  });

  describe("checkAllStatus", () => {
    it("should update worker statuses based on ps output", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      // Initial state needed for port lookup
      const initialWorkers = {
        d1: { port: 8787, status: "unknown" },
        trade: { port: 8788, status: "unknown" },
        webhook: { port: 8789, status: "unknown" },
        telegram: { port: 8790, status: "unknown" },
      };
      mockSetWorkers.mockImplementation((fn) => fn(initialWorkers)); // Mock the state update

      const mockPsOutput = `
user  1234  0.0  0.0 123456 1234 pts/0    Sl+  10:00   0:00 bun run dev -- --port 8787 --local
user  5678  0.0  0.0 123456 1234 pts/1    Sl+  10:01   0:00 bun run dev -- --port 8789
`;
      mockExec.mockResolvedValue({ stdout: mockPsOutput, stderr: "" });

      await service.checkAllStatus();

      expect(mockExec).toHaveBeenCalledWith(
        "ps aux | grep 'bun run dev --' | grep -v grep"
      );
      expect(mockSetWorkers).toHaveBeenCalledTimes(2); // Initial + Update

      // Check the final call to setWorkers to see the result
      const lastSetWorkersCallArg =
        mockSetWorkers.mock.calls[mockSetWorkers.mock.calls.length - 1][0];
      const finalState = lastSetWorkersCallArg(initialWorkers); // Simulate the state update

      expect(finalState.d1.status).toBe("running");
      expect(finalState.trade.status).toBe("stopped");
      expect(finalState.webhook.status).toBe("running");
      expect(finalState.telegram.status).toBe("stopped");
    });

    it("should handle error during ps execution", async () => {
      const service = new WorkerService(
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage
      );
      mockExec.mockRejectedValue(new Error("ps failed"));

      await service.checkAllStatus();

      expect(mockExec).toHaveBeenCalled();
      expect(mockSetWorkers).not.toHaveBeenCalled(); // Status should not be updated on error
    });
  });

  // Add tests for restartWorker, startAllWorkers, stopAllWorkers, restartAllWorkers
  // These will mostly combine the logic tested in start/stop/check
});
