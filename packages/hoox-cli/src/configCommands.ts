import fs from "node:fs/promises";
import path from "node:path";
import { Glob } from "bun";
import { rl, green, yellow, red, dim, print_success, print_error, print_warning } from "./utils.js";

export async function infoConfigFormat() {
  try {
    const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
    const configTomlPath = path.resolve(process.cwd(), "config.toml");

    if ((await Bun.file(configJsoncPath).exists())) {
      console.log(green("Using: config.jsonc (JSONC format)"));
    } else if ((await Bun.file(configTomlPath).exists())) {
      console.log(green("Using: config.toml (TOML format)"));
    } else {
      console.log(
        yellow("No configuration file found. Run 'init' to create one.")
      );
    }

    // Show information about both example files
    const exampleJsoncPath = path.resolve(
      process.cwd(),
      "config.jsonc.example"
    );
    const exampleTomlPath = path.resolve(
      process.cwd(),
      "config.toml.example"
    );

    console.log("\nExample files available:");
    if ((await Bun.file(exampleJsoncPath).exists())) {
      console.log(green("- config.jsonc.example (JSONC format)"));
    } else {
      console.log(red("- config.jsonc.example not found"));
    }

    if ((await Bun.file(exampleTomlPath).exists())) {
      console.log(green("- config.toml.example (TOML format)"));
    } else {
      console.log(red("- config.toml.example not found"));
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    print_error(`Error checking configuration: ${errMsg}`);
  }
}

export async function setupConfigVariables() {
  console.log(green("\n--- Setting up Configuration Files ---"));
  
  const glob = new Glob("**/*.example");
  const cwd = process.cwd();
  
  let found = 0;
  let copied = 0;
  let skipped = 0;

  for await (const file of glob.scan({ cwd, onlyFiles: true, dot: true })) {
    // Ignore node_modules, .git, .wrangler
    if (file.includes("node_modules/") || file.includes(".git/") || file.includes(".wrangler/")) {
        continue;
    }

    found++;
    const examplePath = path.resolve(cwd, file);
    const targetFile = file.replace(/\.example$/, "");
    const targetPath = path.resolve(cwd, targetFile);

    try {
        await fs.access(targetPath);
        // File exists, prompt user
        const answer = await rl.question(yellow(`File ${targetFile} already exists. Overwrite? (y/N): `));
        if (answer.trim().toLowerCase() === 'y') {
            await fs.copyFile(examplePath, targetPath);
            console.log(dim(`Overwrote: ${targetFile}`));
            copied++;
        } else {
            console.log(dim(`Skipped: ${targetFile}`));
            skipped++;
        }
    } catch {
        // File doesn't exist, safe to copy
        await fs.copyFile(examplePath, targetPath);
        console.log(dim(`Created: ${targetFile}`));
        copied++;
    }
  }

  if (found === 0) {
      print_warning("No .example files found.");
  } else {
      print_success(`Setup complete. Copied: ${copied}, Skipped: ${skipped}.`);
  }
}