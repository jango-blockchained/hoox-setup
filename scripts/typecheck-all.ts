#!/usr/bin/env bun
/**
 * Run typecheck across all workspaces in the monorepo
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const rootPath = process.cwd();
const packageJsonPath = path.join(rootPath, "package.json");

if (!fs.existsSync(packageJsonPath)) {
  console.error("package.json not found. Please run from repo root.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

if (!packageJson.workspaces) {
  console.error("No workspaces found in package.json");
  process.exit(1);
}

const workspaces: string[] = [];

// Check if a directory is a git submodule
const isGitSubmodule = (dir: string): boolean => {
  const gitmodulesPath = path.join(rootPath, ".gitmodules");
  if (!fs.existsSync(gitmodulesPath)) return false;

  const gitmodules = fs.readFileSync(gitmodulesPath, "utf-8");
  return gitmodules.includes(`path = ${dir}`);
};

// Expand workspace globs
for (const pattern of packageJson.workspaces) {
  const parts = pattern.split("/");
  const dir = parts[0];

  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir);
    if (pattern.includes("*")) {
      // It's a glob pattern
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const pkgPath = path.join(fullPath, "package.json");

        // Skip git submodules
        if (fs.existsSync(pkgPath) && !isGitSubmodule(fullPath)) {
          workspaces.push(fullPath);
        }
      }
    } else {
      // It's a literal path
      if (
        fs.existsSync(path.join(dir, "package.json")) &&
        !isGitSubmodule(dir)
      ) {
        workspaces.push(dir);
      }
    }
  }
}

console.log(`🔍 Running typecheck for ${workspaces.length} workspaces...\n`);

let hasErrors = false;
let completed = 0;

const results: Array<{ workspace: string; status: "pass" | "fail" }> = [];

// Run typecheck for each workspace
const runTypecheck = (workspace: string, index: number) => {
  const pkgPath = path.join(workspace, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  return new Promise<void>((resolve) => {
    const process = spawn("bun", ["run", "typecheck"], {
      cwd: workspace,
      stdio: "pipe",
    });

    let output = "";
    let errorOutput = "";

    process.stdout?.on("data", (data) => {
      output += data.toString();
    });

    process.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      completed++;
      const status = code === 0 ? "pass" : "fail";
      results.push({ workspace, status });

      if (code === 0) {
        console.log(`✅ [${completed}/${workspaces.length}] ${workspace}`);
      } else {
        console.log(`❌ [${completed}/${workspaces.length}] ${workspace}`);
        hasErrors = true;
        if (output)
          console.log(`   ${output.trim().split("\n").join("\n   ")}`);
        if (errorOutput)
          console.log(`   ${errorOutput.trim().split("\n").join("\n   ")}`);
      }

      resolve();
    });
  });
};

// Run all typecheck commands sequentially
(async () => {
  for (let i = 0; i < workspaces.length; i++) {
    await runTypecheck(workspaces[i], i);
  }

  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (hasErrors) {
    console.log("❌ Typecheck failed in one or more workspaces");
    process.exit(1);
  } else {
    console.log("✅ All workspaces passed typecheck");
    process.exit(0);
  }
})();
