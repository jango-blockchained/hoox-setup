import { test, expect, vi, beforeEach } from "bun:test";
import fs from "node:fs";
import * as utils from "../src/utils.js";
import { cloneMainRepo } from "../src/cloneCommand.js";

// Mock the command runner to prevent actual git clones during tests
vi.mock("../src/utils.js", () => {
  return {
    runCommandAsync: vi.fn().mockResolvedValue({ success: true, stdout: "", stderr: "" }),
    print_success: vi.fn(),
    print_error: vi.fn(),
    print_warning: vi.fn(),
    runCommandSync: vi.fn(),
    print_header: vi.fn(),
    blue: vi.fn((s) => s),
    green: vi.fn((s) => s)
  };
});

// Mock fs to simulate directory existence
vi.mock("node:fs", () => {
  return {
    default: {
      existsSync: vi.fn().mockReturnValue(false)
    }
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  // Mock console.log to avoid noise in test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // @ts-ignore
  fs.existsSync.mockReturnValue(false);
});

test("cloneMainRepo executes git clone with recurse-submodules and depth 1", async () => {
  await cloneMainRepo("my-folder");
  
  expect(utils.runCommandAsync).toHaveBeenCalledWith(
    "git", 
    ["clone", "--recurse-submodules", "--depth", "1", "https://github.com/jango-blockchained/hoox-setup.git", "my-folder"], 
    expect.any(String)
  );
  expect(utils.print_success).toHaveBeenCalledWith("Successfully cloned to ./my-folder");
});

test("cloneMainRepo defaults to hoox-setup if no destination provided", async () => {
  await cloneMainRepo();
  
  expect(utils.runCommandAsync).toHaveBeenCalledWith(
    "git", 
    ["clone", "--recurse-submodules", "--depth", "1", "https://github.com/jango-blockchained/hoox-setup.git", "hoox-setup"], 
    expect.any(String)
  );
  expect(utils.print_success).toHaveBeenCalledWith("Successfully cloned to ./hoox-setup");
});

test("cloneMainRepo handles failure gracefully", async () => {
  // @ts-ignore
  utils.runCommandAsync.mockResolvedValueOnce({ success: false, stdout: "", stderr: "Clone failed" });
  
  await cloneMainRepo("failed-folder");
  
  expect(utils.print_error).toHaveBeenCalledWith("Failed to clone repository: Clone failed");
  expect(process.exitCode).toBe(1);
  
  // reset exit code for other tests
  process.exitCode = 0;
});

test("cloneMainRepo fails early if directory already exists", async () => {
  // @ts-ignore
  fs.existsSync.mockReturnValueOnce(true);
  
  await cloneMainRepo("existing-folder");
  
  expect(utils.print_error).toHaveBeenCalledWith("Target directory ./existing-folder already exists.");
  expect(utils.runCommandAsync).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  
  process.exitCode = 0;
});
