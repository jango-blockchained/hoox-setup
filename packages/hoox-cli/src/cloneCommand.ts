import { blue, green, print_error, print_success, runCommandAsync } from "./utils.js";

export async function cloneMainRepo(destination?: string) {
  const target = destination || "hoox-setup";
  console.log(blue(`\nCloning hoox-setup repository into ./${target}...`));
  
  const result = await runCommandAsync(
    "git",
    ["clone", "https://github.com/jango-blockchained/hoox-setup.git", target],
    process.cwd()
  );

  if (result.success) {
    print_success(`Successfully cloned to ./${target}`);
    console.log(green(`\nNext steps:\n  cd ${target}\n  bun install\n  hoox init`));
  } else {
    print_error(`Failed to clone repository: ${result.stderr}`);
    process.exitCode = 1;
  }
}
