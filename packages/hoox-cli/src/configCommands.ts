import { resolve } from "node:path";
import { promises as fs } from "node:fs";
import {
  rl,
  print_success,
  print_error,
  cyan,
  green,
  yellow,
} from "./utils.js";
import { Glob } from "bun";

export async function setupConfigVariables() {
  console.log(cyan("\n--- Setting up configuration files ---"));

  const glob = new Glob("**/*.example");
  const cwd = process.cwd();
  let copiedCount = 0;
  let skippedCount = 0;

  for await (const file of glob.scan({ cwd, dot: true })) {
    // Ignore node_modules, .git, .wrangler, and .worktrees
    if (
      file.includes("node_modules") ||
      file.includes(".git") ||
      file.includes(".wrangler") ||
      file.includes(".worktrees")
    ) {
      continue;
    }

    const examplePath = resolve(cwd, file);
    const targetPath = examplePath.replace(/\.example$/, "");

    try {
      const exists = await fs
        .access(targetPath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        console.log(yellow(`\nFile already exists: ${targetPath}`));
        const answer = await rl.question("Overwrite? (y/N): ");
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          await fs.copyFile(examplePath, targetPath);
          console.log(green(`✓ Overwrote: ${targetPath}`));
          copiedCount++;
        } else {
          console.log(`Skipped: ${targetPath}`);
          skippedCount++;
        }
      } else {
        await fs.copyFile(examplePath, targetPath);
        console.log(green(`✓ Copied: ${targetPath}`));
        copiedCount++;
      }
    } catch (error) {
      print_error(`Failed to copy ${file}: ${(error as Error).message}`);
    }
  }

  console.log(
    cyan(`\nSetup complete! Copied: ${copiedCount}, Skipped: ${skippedCount}\n`)
  );
}
