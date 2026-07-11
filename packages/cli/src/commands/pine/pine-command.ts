/**
 * `hoox pine` command group — Pine Script strategy tooling.
 *
 * Subcommands:
 *   download        — Download OHLCV historical data from Binance
 *   backtest        — Run a Pine Script against local data
 *   export          — Export per-bar chart data (TradingView-style)
 *   bundle          — Bundle built-in Pine libraries for deployment
 */

import { resolve } from "node:path";
import { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PINE_WORKER_DIR = resolve(process.cwd(), "workers/pine-worker");

/**
 * Spawn a pine-worker script with inherited stdio.
 * Returns the exit code so callers can set `process.exitCode`.
 */
async function spawnPineScript(
  script: string,
  args: string[] = []
): Promise<number> {
  const proc = Bun.spawn(["bun", "run", script, ...args], {
    cwd: PINE_WORKER_DIR,
    stdio: ["inherit", "inherit", "inherit"],
  });
  return await proc.exited;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox pine` command group with subcommands:
 * download, backtest, export, bundle.
 */
export function registerPineCommand(program: Command): void {
  const pineCmd = program
    .command("pine")
    .summary("Pine Script strategy tooling (backtest, data, export)")
    .description(
      `Manage Pine Script strategies, data, and chart exports.

SUBCOMMANDS:
  download          Download OHLCV historical data from Binance
  backtest <file>   Run a Pine Script against local historical data
  export <file>     Export per-bar chart data as CSV or JSON
  bundle            Bundle built-in Pine libraries for deployment

Data is stored under workers/pine-worker/data/ and consumed by the
pine-worker at runtime.

EXAMPLES:
  hoox pine download                               Default: BTCUSDT 1d 365d
  hoox pine download --all                         All default symbols
  hoox pine download -s ETHUSDT --tf 1h -d 30     Custom download
  hoox pine backtest ../grid.pine -s BTCUSDT       Run a strategy
  hoox pine export ../grid.pine --csv              Export chart data as CSV
  hoox pine bundle                                 Bundle libraries for deploy`
    );

  // -- pine download ----------------------------------------------------------

  pineCmd
    .command("download")
    .summary("Download OHLCV historical data from Binance")
    .description(
      `Fetch historical klines from Binance and store as compressed JSON Lines
under workers/pine-worker/data/{SYMBOL}/{TIMEFRAME}/{YYYY}.jsonl.gz.

OPTIONS:
  -s, --symbol     Symbol to download (default: BTCUSDT)
  --tf             Timeframe: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h,
                   8h, 12h, 1d, 3d, 1w, 1M (default: 1d)
  -d, --days       Days of history to fetch (default: 365)
  -a, --all        Download all default symbols (BTC, ETH, SOL, BNB,
                   XRP, ADA, DOGE, AVAX)

EXAMPLES:
  hoox pine download
  hoox pine download --all
  hoox pine download -s ETHUSDT --tf 1h -d 30`
    )
    .option("-s, --symbol <symbol>", "Symbol to download", "BTCUSDT")
    .option("--tf <timeframe>", "Timeframe interval", "1d")
    .option("-d, --days <days>", "Days of history to fetch", "365")
    .option("-a, --all", "Download all default symbols")
    .action(
      withErrorHandling(
        async (opts: {
          symbol: string;
          tf: string;
          days: string;
          all?: boolean;
        }) => {
          const args: string[] = [];
          if (opts.all) {
            args.push("--all");
          } else {
            args.push("--symbol", opts.symbol);
            args.push("--tf", opts.tf);
            if (opts.days !== "365") args.push("--days", opts.days);
          }
          process.exitCode = await spawnPineScript(
            "scripts/download-data.ts",
            args
          );
        },
        { service: "pine" }
      )
    );

  // -- pine backtest <script-path> --------------------------------------------

  pineCmd
    .command("backtest <script-path>")
    .summary("Run a Pine Script against local historical data")
    .description(
      `Execute a Pine Script strategy against historical OHLCV data and
print trade events (entries, exits, orders) to stdout.

ARGUMENTS:
  script-path    Path to the .pine script file

OPTIONS:
  -s, --symbol   Trading symbol (default: BTCUSDT)
  --tf           Timeframe (default: 5m)
  -b, --bars     Number of bars to evaluate (default: 864)

EXAMPLES:
  hoox pine backtest ../grid.pine
  hoox pine backtest ../grid.pine -s ETHUSDT --tf 15m -b 500`
    )
    .option("-s, --symbol <symbol>", "Trading symbol", "BTCUSDT")
    .option("--tf <timeframe>", "Timeframe", "5m")
    .option("-b, --bars <bars>", "Number of bars to evaluate", "864")
    .action(
      withErrorHandling(
        async (
          scriptPath: string,
          opts: { symbol: string; tf: string; bars: string }
        ) => {
          process.exitCode = await spawnPineScript("scripts/run-backtest.ts", [
            scriptPath,
            opts.symbol,
            opts.tf,
            opts.bars,
          ]);
        },
        { service: "pine" }
      )
    );

  // -- pine export <script-path> ----------------------------------------------

  pineCmd
    .command("export <script-path>")
    .summary("Export per-bar chart data (TradingView-style)")
    .description(
      `Run a Pine Script and export per-bar OHLCV + plot values as
CSV or JSON — matching TradingView's "Export chart data" layout.

ARGUMENTS:
  script-path    Path to the .pine script file

OPTIONS:
  -s, --symbol   Trading symbol (default: BTCUSDT)
  --tf           Timeframe (default: 1d)
  -b, --bars     Number of bars to evaluate (default: 500)
  --csv          Export as CSV (default: JSON)

Output files are written to the current directory:
  {SYMBOL}_{TIMEFRAME}_chart.csv   or   {SYMBOL}_{TIMEFRAME}_chart.json

EXAMPLES:
  hoox pine export ../grid.pine
  hoox pine export ../grid.pine -s ETHUSDT --csv
  hoox pine export ../grid.pine --tf 1h -b 200`
    )
    .option("-s, --symbol <symbol>", "Trading symbol", "BTCUSDT")
    .option("--tf <timeframe>", "Timeframe", "1d")
    .option("-b, --bars <bars>", "Number of bars to evaluate", "500")
    .option("--csv", "Export as CSV (default: JSON)")
    .action(
      withErrorHandling(
        async (
          scriptPath: string,
          opts: { symbol: string; tf: string; bars: string; csv?: boolean }
        ) => {
          const args: string[] = [scriptPath, opts.symbol, opts.tf, opts.bars];
          if (opts.csv) args.push("--csv");
          process.exitCode = await spawnPineScript(
            "scripts/export-chart.ts",
            args
          );
        },
        { service: "pine" }
      )
    );

  // -- pine bundle ------------------------------------------------------------

  pineCmd
    .command("bundle")
    .summary("Bundle built-in Pine libraries for deployment")
    .description(
      `Embed libraries/*.pine files into src/module/bundled-libraries.ts
so library imports work in the Cloudflare Worker runtime.

This runs automatically as a prebuild step before deploy, but can
also be run manually after updating library files.

EXAMPLES:
  hoox pine bundle`
    )
    .action(
      withErrorHandling(
        async () => {
          process.exitCode = await spawnPineScript(
            "scripts/bundle-libraries.ts"
          );
        },
        { service: "pine" }
      )
    );

  // Default action: show help when `hoox pine` is called without subcommand
  pineCmd.action(() => {
    pineCmd.help();
  });
}
