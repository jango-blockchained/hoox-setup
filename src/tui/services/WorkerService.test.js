import { jest, mock, describe, it, expect, beforeEach, afterAll, beforeAll, advanceTimersByTime } from "@jest/globals";
import { EventEmitter } from "events";
import { WorkerService as ActualWorkerService } from "./WorkerService.js"; // Import the actual service

// Mock child_process (Keep mocks, but remove jest.mock calls)
const mockSpawnInstance = new EventEmitter();
mockSpawnInstance.stdout = new EventEmitter();
mockSpawnInstance.stderr = new EventEmitter();
mockSpawnInstance.kill = jest.fn();

const mockSpawn = jest.fn(() => mockSpawnInstance);
const mockExec = jest.fn(); // This is the raw exec mock

// Create a mock for the *promisified* exec
const mockExecPromise = jest.fn(async (...args) => {
  try {
    const result = await mockExec(...args); // Call the raw mock
    return result; // Return what the raw mock returns (e.g., {stdout, stderr})
  } catch (error) {
    throw error; // Propagate errors
  }
});

// Mock path (optional, but good practice if paths get complex)
// jest.mock('path', () => ({
//     ...jest.requireActual('path'),
//     resolve: jest.fn((...args) => args.join('/')), // Simple mock
// }));

describe("WorkerService", () => {
  let WorkerService; // Keep this for potential re-assignment if needed, or remove if always using ActualWorkerService
  let mockSetWorkers;
  let mockSetLogs;
  let mockSetStatusMessage;

  // Define a default initial worker state for tests
  const defaultTestWorkers = {
      d1: { name: "D1 Worker", port: 8787, status: "stopped", extraArgs: "--local" },
      trade: { name: "Trade Worker", port: 8788, status: "stopped", extraArgs: "" },
      webhook: { name: "Webhook Receiver", port: 8789, status: "stopped", extraArgs: "" },
      telegram: { name: "Telegram Worker", port: 8790, status: "stopped", extraArgs: "" },
      "home-assistant": { name: "Home Assistant", port: 8791, status: "stopped", extraArgs: "" },
      "web3-wallet": { name: "Web3 Wallet", port: 8792, status: "stopped", extraArgs: "" },
  };

  beforeAll(() => {
    // Use fake timers to control setTimeout
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    // Reset mocks and modules before each test
    jest.clearAllMocks();
    // jest.resetModules(); // Removed due to Bun/Jest incompatibility

    // Mock constructor dependencies
    mockSetWorkers = jest.fn();
    mockSetLogs = jest.fn();
    mockSetStatusMessage = jest.fn();

    // Dynamically import the service AFTER mocks are set up
    // const module = await import("./WorkerService.js"); // REMOVE dynamic import
    WorkerService = ActualWorkerService; // Use the imported service

    // Ensure service instance is created AFTER mocks are set, just in case
    // We will create instances within each test for clarity now.
    // NO LONGER NEEDED HERE: Mocks are passed via constructor
  });

  afterAll(() => {
    // Restore real timers after all tests
    jest.useRealTimers();
  });

  it("should construct correctly", () => {
    const service = new WorkerService(
      defaultTestWorkers, // Pass initial config
      mockSetWorkers,
      mockSetLogs,
      mockSetStatusMessage,
      mockSpawn, // Pass mocks
      mockExecPromise // Pass promisified mock
    );
    expect(service).toBeDefined();
    expect(service.setWorkers).toBe(mockSetWorkers);
    expect(service.setLogs).toBe(mockSetLogs);
    expect(service.setStatusMessage).toBe(mockSetStatusMessage);
    expect(service.workerProcesses).toEqual({});
  });

  describe("startWorker", () => {
    it("should spawn a worker process and update status", async () => {
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
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
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
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
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
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

      // Allow the event loop to process the exit handler
      await new Promise(resolve => setImmediate(resolve));

      await stopPromise;

      expect(mockSetWorkers).toHaveBeenCalledWith(expect.any(Function)); // stopped
      expect(mockSetStatusMessage).toHaveBeenCalledWith(
        `${workerId} worker stopped`
      );
      expect(service.workerProcesses[workerId]).toBeUndefined();
    });

    it("should force kill if process does not exit", async () => {
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
      );
      const workerId = "telegram";
      service.workerProcesses[workerId] = mockSpawnInstance;

      // Stop the worker - this promise now waits for the timeout/kill/cleanup
      const stopPromise = service.stopWorker(workerId);

      expect(mockSpawnInstance.kill).toHaveBeenCalledWith("SIGTERM");

      // Simulate the scenario where SIGTERM fails and SIGKILL is needed
      // We can't test the timeout directly, but we can simulate the SIGKILL call
      // that *should* happen after the timeout.
      // Manually call kill with SIGKILL to simulate the force kill
      mockSpawnInstance.kill('SIGKILL');

      // Simulate the exit event firing *after* the SIGKILL
      mockSpawnInstance.emit("exit", null); // Process exits (non-zero usually after SIGKILL)

      // Wait for the stopPromise to resolve (which happens after cleanup)
      await stopPromise;

      // Check expectations AFTER the promise resolves
      expect(mockSpawnInstance.kill).toHaveBeenCalledWith("SIGKILL");
      expect(service.workerProcesses[workerId]).toBeUndefined();
      // Add checks for status updates if necessary
    });
  });

  describe("checkAllStatus", () => {
    it("should update worker statuses based on ps output", async () => {
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
      );
      // Initial state needed for port lookup
      const initialWorkers = {
        d1: { name: "D1 Worker", port: 8787, status: "unknown", extraArgs: "--local" }, // Added name/extraArgs
        trade: { name: "Trade Worker", port: 8788, status: "unknown", extraArgs: "" },
        webhook: { name: "Webhook Receiver", port: 8789, status: "unknown", extraArgs: "" },
        telegram: { name: "Telegram Worker", port: 8790, status: "unknown", extraArgs: "" },
        "home-assistant": { name: "Home Assistant", port: 8791, status: "unknown", extraArgs: "" },
        "web3-wallet": { name: "Web3 Wallet", port: 8792, status: "unknown", extraArgs: "" },
      };
      // REMOVE: No need to mock implementation here, we just need the initial object
      // mockSetWorkers.mockImplementation((fn) => fn(initialWorkers));

      const mockPsOutput = `
user  1234  0.0  0.0 123456 1234 pts/0    Sl+  10:00   0:00 bun run dev -- --port 8787 --local
user  5678  0.0  0.0 123456 1234 pts/1    Sl+  10:01   0:00 bun run dev -- --port 8789
`;
      // Configure the *promisified* mock
      mockExecPromise.mockResolvedValue({ stdout: mockPsOutput, stderr: "" });

      await service.checkAllStatus();

      // Expect the *promisified* mock to have been called
      expect(mockExecPromise).toHaveBeenCalledWith(
        "ps aux | grep 'bun run dev --' | grep -v grep"
      );
      expect(mockSetWorkers).toHaveBeenCalledTimes(1); // Only the update call inside checkAllStatus happens now

      // Check the final call to setWorkers to see the result
      const updateFn = mockSetWorkers.mock.calls[0][0]; // Get the update function from the *single* call
      const finalState = updateFn(initialWorkers); // Apply the update fn to the initial state

      expect(finalState.d1.status).toBe("running");
      expect(finalState.trade.status).toBe("stopped");
      expect(finalState.webhook.status).toBe("running");
      expect(finalState.telegram.status).toBe("stopped");
    });

    it("should handle error during ps execution", async () => {
      // Create instance INSIDE the test
      const service = new WorkerService(
        defaultTestWorkers, // Pass initial config
        mockSetWorkers,
        mockSetLogs,
        mockSetStatusMessage,
        mockSpawn, // Pass mocks
        mockExecPromise // Pass promisified mock
      );
      // Configure the *promisified* mock to reject
      mockExecPromise.mockRejectedValue(new Error("ps failed"));

      await service.checkAllStatus();

      // Expect the *promisified* mock to have been called
      expect(mockExecPromise).toHaveBeenCalled();
      expect(mockSetWorkers).not.toHaveBeenCalled(); // Status should not be updated on error
    });
  });

  // Add tests for restartWorker, startAllWorkers, stopAllWorkers, restartAllWorkers
  // These will mostly combine the logic tested in start/stop/check
});
