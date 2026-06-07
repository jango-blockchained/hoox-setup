#!/usr/bin/env bun
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const workDir = "/home/jango/Git/hoox-setup";
process.chdir(workDir);

console.log(
  "================================================================================"
);
console.log("BUILD VALIDATION REPORT");
console.log(
  "================================================================================\n"
);

const results = {
  testPass: false,
  testOutput: "",
  coverage: null,
  typecheckPass: false,
  typecheckOutput: "",
};

// 1. Run the specific test file
console.log("[1/3] Running: bun test packages/shared/src/path-utils.test.ts\n");
try {
  const testOutput = execSync(
    "bun test packages/shared/src/path-utils.test.ts 2>&1",
    {
      cwd: workDir,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  results.testOutput = testOutput;
  results.testPass = true;
  console.log(testOutput);
} catch (error) {
  results.testOutput = error.stdout || error.message;
  results.testPass = false;
  console.log("Test output:");
  console.log(error.stdout || error.message);
  console.log("Exit code:", error.status);
}

// 2. Check coverage output
console.log("\n[2/3] Checking Coverage Output\n");
const coverageDir = join(workDir, "coverage");
if (existsSync(coverageDir)) {
  const summaryPath = join(coverageDir, "coverage-summary.json");
  if (existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
      results.coverage = summary;

      if (summary.total) {
        console.log("Coverage Summary:");
        console.log(`  Statements: ${summary.total.statements.pct}%`);
        console.log(`  Branches:   ${summary.total.branches.pct}%`);
        console.log(`  Functions:  ${summary.total.functions.pct}%`);
        console.log(`  Lines:      ${summary.total.lines.pct}%`);
      }
    } catch (e) {
      console.log("Could not parse coverage summary:", e.message);
    }
  } else {
    console.log("Coverage summary not found at:", summaryPath);
  }
} else {
  console.log("Coverage directory not found at:", coverageDir);
}

// 3. Run typecheck
console.log("\n[3/3] Running: bun run typecheck\n");
try {
  const typecheckOutput = execSync("bun run typecheck 2>&1", {
    cwd: workDir,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  results.typecheckOutput = typecheckOutput;
  results.typecheckPass = true;
  console.log(typecheckOutput);
} catch (error) {
  results.typecheckOutput = error.stdout || error.message;
  results.typecheckPass = false;
  console.log("Typecheck output:");
  console.log(error.stdout || error.message);
  console.log("Exit code:", error.status);
}

// Final summary
console.log(
  "\n================================================================================"
);
console.log("FINAL REPORT");
console.log(
  "================================================================================\n"
);

console.log(`Test Status:      ${results.testPass ? "✓ PASS" : "✗ FAIL"}`);
console.log(`Typecheck Status: ${results.typecheckPass ? "✓ PASS" : "✗ FAIL"}`);

if (results.coverage && results.coverage.total) {
  console.log("\nCoverage Metrics:");
  console.log(`  Statements: ${results.coverage.total.statements.pct}%`);
  console.log(`  Branches:   ${results.coverage.total.branches.pct}%`);
  console.log(`  Functions:  ${results.coverage.total.functions.pct}%`);
  console.log(`  Lines:      ${results.coverage.total.lines.pct}%`);
}

const overallPass = results.testPass && results.typecheckPass;
console.log(`\nOverall Status:   ${overallPass ? "✓ SUCCESS" : "✗ FAILURE"}`);
console.log(
  "================================================================================\n"
);

process.exit(overallPass ? 0 : 1);
