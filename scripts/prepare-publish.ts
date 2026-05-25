#!/usr/bin/env bun
/**
 * Prepare packages for npm publishing by replacing workspace:* with actual versions
 * Usage: bun scripts/prepare-publish.ts <package-path>
 */

import fs from "fs";
import path from "path";

const packagePath = process.argv[2];
if (!packagePath) {
  console.error("Usage: bun scripts/prepare-publish.ts <package-path>");
  process.exit(1);
}

const packageJsonPath = path.join(packagePath, "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error(`package.json not found at ${packageJsonPath}`);
  process.exit(1);
}

// Read the package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

// Get all workspace package versions from the monorepo
const monorepoRootPath = path.resolve(packagePath, "../..");
const packagesDir = path.join(monorepoRootPath, "packages");
const workersDir = path.join(monorepoRootPath, "workers");

const workspaceVersions: Record<string, string> = {};

// Load versions from packages
if (fs.existsSync(packagesDir)) {
  for (const dir of fs.readdirSync(packagesDir)) {
    const pkgPath = path.join(packagesDir, dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      workspaceVersions[pkg.name] = pkg.version;
    }
  }
}

// Load versions from workers
if (fs.existsSync(workersDir)) {
  for (const dir of fs.readdirSync(workersDir)) {
    const pkgPath = path.join(workersDir, dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      workspaceVersions[pkg.name] = pkg.version;
    }
  }
}

// Replace workspace:* with actual versions
const replaceDependencies = (deps: Record<string, string> | undefined) => {
  if (!deps) return;
  for (const [name, version] of Object.entries(deps)) {
    if (version === "workspace:*" && workspaceVersions[name]) {
      deps[name] = `^${workspaceVersions[name]}`;
      console.log(`  ${name}: workspace:* → ^${workspaceVersions[name]}`);
    }
  }
};

console.log(
  `📦 Preparing ${packageJson.name}@${packageJson.version} for publishing...`
);

replaceDependencies(packageJson.dependencies);
replaceDependencies(packageJson.devDependencies);
replaceDependencies(packageJson.peerDependencies);

// Write back the modified package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
console.log(`✅ Updated ${packageJsonPath}`);
