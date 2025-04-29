import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { $ } from 'bun';

const rootDir = resolve(import.meta.dir, '..');
const workersDir = join(rootDir, 'workers');
const args = process.argv.slice(2); // Get command-line arguments passed to the script

interface TestResult {
  worker: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

async function runTestsInWorker(workerDir: string): Promise<TestResult> {
  const workerName = workerDir.split('/').pop() ?? workerDir;
  console.log(`\n🧪 Running tests for ${workerName}...`);
  // Pass arguments to the bun test command
  const commandArgs = ['bun', 'test', ...args];

  try {
    const testDir = join(workerDir, 'test');
    // Check if test directory exists
    await readdir(testDir); // Throws if directory doesn't exist

    // Ensure dependencies are installed for the specific worker
    console.log(`📦 Ensuring dependencies for ${workerName}...`);
    await $.cwd(workerDir)`bun install`.nothrow().quiet();

    // Use shell-escape logic and pass arguments
    // Note: $.cwd(...).$(...) creates a subshell, respecting cwd
    const { exitCode, stdout, stderr } = await $.cwd(workerDir)`${commandArgs}`.nothrow().quiet();

    const result: TestResult = {
      worker: workerName,
      exitCode,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };

    if (exitCode === 0) {
      console.log(`✅ Tests passed for ${workerName}`);
    } else {
      console.error(`❌ Tests failed for ${workerName} (Exit Code: ${exitCode})`);
      if (result.stdout) console.log('--- STDOUT ---');
      console.log(result.stdout);
      if (result.stderr) console.error('--- STDERR ---');
      console.error(result.stderr);
    }
    return result;

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // console.log(`ℹ️ No 'test' directory found for ${workerName}, skipping.`);
      // Return a "skipped" result
      return {
        worker: workerName,
        exitCode: 0, // Treat as success (skipped)
        stdout: "Skipped: No 'test' directory found.",
        stderr: '',
      };
    } else {
      console.error(`🚨 Error running tests for ${workerName}:`, error);
      return {
        worker: workerName,
        exitCode: 1, // Indicate failure due to error
        stdout: '',
        stderr: String(error),
      };
    }
  }
}

async function main() {
  console.log('🔍 Discovering workers and running tests...');
  let overallExitCode = 0;
  const allResults: TestResult[] = [];

  try {
    const entries = await readdir(workersDir, { withFileTypes: true });
    const workerDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => join(workersDir, entry.name));

    if (workerDirs.length === 0) {
        console.log('🤷 No worker directories found in ./workers');
        process.exit(0);
    }

    for (const workerDir of workerDirs) {
      const result = await runTestsInWorker(workerDir);
      allResults.push(result);
      if (result.exitCode !== 0) {
        overallExitCode = 1; // Mark failure if any worker fails
      }
    }

  } catch (error) {
    console.error('🚨 Failed to read workers directory:', error);
    overallExitCode = 1;
  }

  console.log('\n--- Test Summary ---');
  allResults.forEach(result => {
    const status = result.exitCode === 0 ? (result.stdout.startsWith('Skipped') ? '⏭️ Skipped' : '✅ Passed') : '❌ Failed';
    console.log(`- ${result.worker}: ${status}`);
  });

  if (overallExitCode === 0) {
    console.log('\n🎉 All worker tests passed (or were skipped)!');
  } else {
    console.error('\n🔥 Some worker tests failed.');
  }

  process.exit(overallExitCode);
}

await main(); 