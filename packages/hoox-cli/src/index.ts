import ansis from "ansis";
import { loadCommands } from "./cli/loader.js";
import { CommandRegistry } from "./cli/registry.js";
import { AppObserver } from "./core/observer.js";
import { AppEngine } from "./core/engine.js";
import { CloudflareAdapter } from "./adapters/cloudflare.js";
import { BunAdapter } from "./adapters/bun.js";
import { WorkersAdapter } from "./adapters/workers.js";
import type { CommandContext, Command } from "./core/types.js";

interface CommandGroup {
  title: string;
  commands: Array<{ name: string; description: string }>;
}

function printBanner(commands: Record<string, Command>): void {
  const d = ansis.dim;
  const b = ansis.bold;
  const y = ansis.yellow;
  const c = ansis.cyan;

  console.log("");
  console.log(d("  ╭─────────────────────────────────────────────────╮"));
  console.log(d("  │") + b(y("  ⚡ HOOX")) + d("  ─  Edge-Executed Trading System    ") + d("│"));
  console.log(d("  ╰─────────────────────────────────────────────────╯"));
  console.log("");
  console.log(b("  USAGE"));
  console.log(d("  $ ") + "hoox" + d(" <command> [options]"));
  console.log("");
  
  // Group commands by category
  const groups: Record<string, CommandGroup> = {};
  
  for (const [name, cmd] of Object.entries(commands)) {
    const [category] = name.split(":");
    if (!groups[category]) {
      groups[category] = {
        title: category.charAt(0).toUpperCase() + category.slice(1),
        commands: [],
      };
    }
    groups[category].commands.push({
      name,
      description: cmd.description || "",
    });
  }

  console.log(b("  COMMANDS"));
  
  const categoryOrder = ["init", "clone", "checkSetup", "config", "workers", "trade", "dashboard", "cf", "logs", "housekeeping", "waf", "r2Provision"];
  
  for (const cat of categoryOrder) {
    if (!groups[cat]) continue;
    const group = groups[cat];
    console.log("");
    console.log(b(`  ${group.title}`));
    for (const cmd of group.commands.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(d(`    ${c(cmd.name.padEnd(25))} ${cmd.description}`));
    }
    delete groups[cat];
  }
  
  // Print any remaining uncategorized commands
  for (const [, group] of Object.entries(groups)) {
    console.log("");
    console.log(b(`  ${group.title}`));
    for (const cmd of group.commands.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(d(`    ${c(cmd.name.padEnd(25))} ${cmd.description}`));
    }
  }
  
  console.log("");
  console.log(d("  Run ") + c("hoox <command> --help") + d(" for detailed usage"));
  console.log("");
}

function parseArgs(argv: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const commands = await loadCommands();

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printBanner(commands);
    process.exit(0);
  }
  if (args[0] === "--version" || args[0] === "-V") {
    const pkg = await Bun.file(import.meta.dir + "/../package.json").json();
    console.log(pkg.version);
    process.exit(0);
  }

  const observer = new AppObserver();
  const adapters = {
    cloudflare: new CloudflareAdapter(),
    bun: new BunAdapter(),
    workers: new WorkersAdapter(),
  };
  const engine = new AppEngine(observer, adapters);

  await engine.initialize();

  const registry = new CommandRegistry();
  for (const [name, cmd] of Object.entries(commands)) {
    registry.register(name, cmd);
  }

  const ctx: CommandContext = {
    observer,
    engine,
    adapters,
    cwd: process.cwd(),
    args: parseArgs(args.slice(1)),
  };

  engine.startListening();

  const [cmdName, ...cmdArgs] = args;
  const command = registry.get(cmdName);

  if (!command) {
    console.error(ansis.red(`Unknown command: ${cmdName}`));
    console.error(ansis.dim(`Run "hoox --help" to see available commands.`));
    process.exit(1);
  }

  observer.emit("command:start", { cmd: cmdName, args: cmdArgs });

  try {
    await command.execute(ctx);
  } catch (error) {
    observer.setState({ commandStatus: "error" });
    observer.emit("command:error", { cmd: cmdName, error });

    if (error instanceof Error) {
      console.error(ansis.red(`✖ ${error.message}`));
    }
    process.exit(1);
  } finally {
    engine.stopListening();
  }
}

process.on("uncaughtException", (err) => {
  console.error(ansis.red("Uncaught Exception:"), err.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log(ansis.yellow("\nInterrupted by user"));
  process.exit(0);
});

main();
