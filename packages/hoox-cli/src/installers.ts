import { runCommandAsync } from "./utils.js";

export async function downloadBun(): Promise<void> {
  console.log("Downloading Bun...");
  await runCommandAsync("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"], process.cwd());
}