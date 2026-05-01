import { parseArgs } from "node:util";
import ansis from "ansis";

export interface CommandDef {
  description: string;
  options?: Record<
    string,
    {
      type: "string" | "boolean";
      short?: string;
      description?: string;
      default?: string | boolean;
    }
  >;
  args?: string[];
  handler: (args: Record<string, any>, positionals: string[]) => Promise<void>;
  subcommands?: Record<string, CommandDef>;
}

export interface RouterConfig {
  name: string;
  version: string;
  description: string;
  commands: Record<string, CommandDef>;
}

/**
 * Command groups for organized help display.
 */
const COMMAND_GROUPS: Record<string, string[]> = {
  "Getting Started": ["init", "clone", "install-bun", "check-setup"],
  Workers: ["workers", "pages", "tui"],
  Cloudflare: ["cf", "waf", "r2"],
  Configuration: ["config", "setup", "keys", "secrets"],
  Observability: ["logs", "housekeeping", "doctor", "status"],
  Dashboard: ["dashboard"],
};

/**
 * Prints branded banner + help for bare `hoox` invocation.
 */
function printBanner(config: RouterConfig): void {
  const b = ansis.bold;
  const d = ansis.dim;
  const c = ansis.cyan;
  const g = ansis.green;
  const y = ansis.yellow;
  const w = ansis.white;

  console.log("");
  console.log(d("  ╭─────────────────────────────────────────────────╮"));
  console.log(
    d("  │") +
      b(y("  ⚡ HOOX")) +
      d("  ─  Edge-Executed Trading System    ") +
      d("│")
  );
  console.log(
    d("  │") +
      d(`     v${config.version}  ·  Zero Latency  ·  Bun-Native  `) +
      d("│")
  );
  console.log(d("  ╰─────────────────────────────────────────────────╯"));
  console.log("");
  console.log(b("  USAGE"));
  console.log(d("  $ ") + w("hoox") + d(" <command> [options]"));
  console.log("");

  for (const [group, cmdNames] of Object.entries(COMMAND_GROUPS)) {
    const existing = cmdNames.filter((n) => config.commands[n]);
    if (existing.length === 0) continue;

    console.log(b(`  ${group.toUpperCase()}`));
    for (const name of existing) {
      const cmd = config.commands[name];
      const padding = " ".repeat(Math.max(0, 20 - name.length));
      console.log(`    ${g(name)}${padding}${d(cmd.description)}`);
    }
    console.log("");
  }

  console.log(d("  ╭─────────────────────────────────────────────────╮"));
  console.log(
    d("  │") +
      d("  Run ") +
      c("hoox <command> --help") +
      d(" for detailed usage   ") +
      d("│")
  );
  console.log(
    d("  │") +
      d("  ") +
      d("🛡 Secured by Zero Trust Architecture") +
      d("        │")
  );
  console.log(d("  ╰─────────────────────────────────────────────────╯"));
  console.log("");
}

/**
 * Prints help for a specific command.
 */
function printCommandHelp(name: string, cmd: CommandDef): void {
  const b = ansis.bold;
  const d = ansis.dim;
  const c = ansis.cyan;

  console.log("");
  console.log(b(`  hoox ${name}`) + d(` — ${cmd.description}`));
  console.log("");

  if (cmd.args && cmd.args.length > 0) {
    console.log(b("  ARGUMENTS"));
    for (const arg of cmd.args) {
      console.log(`    ${c(`<${arg}>`)}`);
    }
    console.log("");
  }

  if (cmd.options && Object.keys(cmd.options).length > 0) {
    console.log(b("  OPTIONS"));
    for (const [flag, opt] of Object.entries(cmd.options)) {
      const short = opt.short ? `-${opt.short}, ` : "    ";
      const desc = opt.description || "";
      console.log(`    ${short}--${flag}  ${d(desc)}`);
    }
    console.log("");
  }

  if (cmd.subcommands) {
    console.log(b("  SUBCOMMANDS"));
    for (const [sub, subCmd] of Object.entries(cmd.subcommands)) {
      console.log(`    ${c(sub)}  ${d(subCmd.description)}`);
    }
    console.log("");
  }
}

/**
 * Routes argv to the matching command handler.
 */
export async function runRouter(config: RouterConfig): Promise<void> {
  const argv = process.argv.slice(2);

  // No command → show banner
  if (argv.length === 0) {
    printBanner(config);
    return;
  }

  // Version flag
  if (argv[0] === "--version" || argv[0] === "-V") {
    console.log(config.version);
    return;
  }

  // Help flag
  if (argv[0] === "--help" || argv[0] === "-h") {
    printBanner(config);
    return;
  }

  const commandName = argv[0];
  const cmd = config.commands[commandName];

  if (!cmd) {
    console.error(ansis.red(`Unknown command: ${commandName}`));
    console.error(ansis.dim(`Run "hoox --help" to see available commands.`));
    process.exit(1);
  }

  // Check for subcommands
  let activeCmd = cmd;
  let activeName = commandName;
  let argsStart = 1;

  if (cmd.subcommands && argv.length > 1 && !argv[1].startsWith("-")) {
    const subName = argv[1];
    const sub = cmd.subcommands[subName];
    if (sub) {
      activeCmd = sub;
      activeName = `${commandName} ${subName}`;
      argsStart = 2;
    }
  }

  // Help for specific command
  const remaining = argv.slice(argsStart);
  if (remaining.includes("--help") || remaining.includes("-h")) {
    printCommandHelp(activeName, activeCmd);
    return;
  }

  // Parse options
  const optionsDef: Record<
    string,
    { type: "string" | "boolean"; short?: string; default?: string | boolean }
  > = {};
  if (activeCmd.options) {
    for (const [key, opt] of Object.entries(activeCmd.options)) {
      optionsDef[key] = {
        type: opt.type,
        short: opt.short,
        default: opt.default,
      };
    }
  }

  try {
    const { values, positionals } = parseArgs({
      args: remaining,
      options: optionsDef,
      allowPositionals: true,
      strict: false,
    });

    await activeCmd.handler(values as Record<string, any>, positionals);
  } catch (err) {
    if (err instanceof Error) {
      console.error(ansis.red(`✖ ${err.message}`));
    }
    process.exit(1);
  }
}
