#!/usr/bin/env bun
/**
 * Hoox CLI Animated Banner Showcase
 * Run: bun run tmp/animated-banners.ts
 *
 * Previews 3 animated banner concepts:
 *   1. Pulse  — letter-wave glow across H O O X
 *   2. Radar  — scan-line sweep revealing the art
 *   3. Assemble — blocks fly in to build each letter
 */

// ── Self-contained ANSI helpers (no external deps, works standalone) ─────

const ansi = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  boldCyan: (s: string) => `\x1b[1;36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[39m`,
  accent: (s: string) => `\x1b[36;1m${s}\x1b[0m`,
  heading: (s: string) => `\x1b[1;36m${s}\x1b[0m`,
  white: (s: string) => `\x1b[37m${s}\x1b[39m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[39m`,
  clearLine: "\x1b[K",
  cursorUp: (n: number) => `\x1b[${n}A`,
  cursorDown: (n: number) => `\x1b[${n}B`,
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
};

const TAGLINE = "Cloudflare Workers Platform";
const VERSION = "0.3.0";

// ── Shared: the HOOX ASCII art (reused by all variants) ─────────────────

const LEGACY_ART = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

const HORIZON_ART = [
  "╔═══╗ ╔═══╗ ╔═══╗ ╔═══╗",
  "║ ║ ║ ║   ║ ║   ║ ║ ║ ║",
  "║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║",
  "║ ╚═╝ ║ ╚═╝ ║ ║ ║ ║ ╚═╝",
  "║     ║     ║ ╚═╝ ║     ",
  "╚═════╝ ╚═════╝ ╚═══╝ ╚═════╝",
];

// ── Sleep helper ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Label helper ────────────────────────────────────────────────────────

function label(text: string) {
  console.log(
    `\n${ansi.gray("━━━")} ${ansi.white(text)} ${ansi.gray("━━━")}\n`
  );
}

// ── 1. PULSE — letter-wave glow ─────────────────────────────────────────

async function demoPulse() {
  label("Version 1: PULSE");
  await sleep(400);

  const height = LEGACY_ART.length + 2; // art + tagline + bottom border
  const cols = LEGACY_ART[0].length;

  // We treat each letter column zone: H(0-9), O(10-19), O(20-29), X(30-38) (approximate)
  const zones = [
    [0, 9], // H
    [10, 19], // O
    [20, 26], // O (narrower in ASCII)
    [27, 38], // X
  ];

  async function pulseCycle(count: number) {
    for (let cycle = 0; cycle < count; cycle++) {
      for (let zi = 0; zi < zones.length; zi++) {
        // Build frame: the zone that's pulsing gets accent colour, others dim
        const lines = LEGACY_ART.map((row) => {
          const parts = zones.map(([start, end], idx) => {
            const seg =
              row.slice(start, end + 1) || " ".repeat(end - start + 1);
            if (idx === zi) return ansi.accent(seg);
            if (
              idx < zi ||
              (cycle > 0 && idx === (zi - 1 + zones.length) % zones.length)
            )
              return ansi.heading(seg);
            return ansi.dim(seg);
          });
          return parts.join("");
        });

        const frame = lines.join("\n");
        // Rewind and write
        process.stdout.write(ansi.cursorUp(height));
        process.stdout.write(frame + "\n");

        const gap = Math.floor((48 - TAGLINE.length - VERSION.length - 2) / 2);
        const tag = ` ${" ".repeat(gap)}${ansi.dim(TAGLINE)} ${ansi.dim(`v${VERSION}`)}`;
        process.stdout.write(ansi.clearLine + tag + "\n");
        process.stdout.write(ansi.clearLine + ansi.dim("─".repeat(48)));

        await sleep(100);
      }
    }
  }

  // Initial render
  const banner = LEGACY_ART.map((l) => ` ${ansi.dim(l)}`).join("\n");
  process.stdout.write(ansi.hideCursor);
  process.stdout.write(banner + "\n");
  process.stdout.write("\n".repeat(2)); // placeholder for tagline + border

  await pulseCycle(2);

  // Final: all lit
  const final = LEGACY_ART.map((l) => ` ${ansi.heading(l)}`).join("\n");
  process.stdout.write(ansi.cursorUp(height));
  process.stdout.write(final + "\n");
  const gap = Math.floor((48 - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${ansi.dim(TAGLINE)} ${ansi.dim(`v${VERSION}`)}`;
  process.stdout.write(ansi.clearLine + tag + "\n");
  process.stdout.write(ansi.clearLine + ansi.dim("─".repeat(48)) + "\n");

  process.stdout.write(ansi.showCursor);
  await sleep(1200);
}

// ── 2. RADAR — scan-line sweep ──────────────────────────────────────────

async function demoRadar() {
  label("Version 2: RADAR");
  await sleep(400);

  const height = HORIZON_ART.length + 2; // art + tagline + bottom
  const bw = 56;
  const inner = ansi.dim("─").repeat(bw - 2);
  const scanChar = ansi.green("█");
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 4) / 2);

  process.stdout.write(ansi.hideCursor);

  // Reveal rows progressively
  for (let revealed = 0; revealed <= HORIZON_ART.length; revealed++) {
    const topBorder = ` ${ansi.dim("╭")}${inner}${ansi.dim("╮")}`;
    const bottomBorder = ` ${ansi.dim("╰")}${inner}${ansi.dim("╯")}`;

    const rows: string[] = [];

    HORIZON_ART.forEach((row, idx) => {
      if (idx < revealed) {
        // This row is fully revealed
        rows.push(` ${ansi.accent(row)}`);
      } else if (idx === revealed) {
        // This row has the scan line — render with scan overlay
        const scanIdx = Math.floor((Date.now() / 80) % row.length);
        const before = row.slice(0, scanIdx);
        const scan = row[scanIdx] || " ";
        const after = row.slice(scanIdx + 1);
        rows.push(` ${ansi.dim(before)}${scanChar}${ansi.dim(after)}`);
      } else {
        // Not yet revealed — dim
        rows.push(` ${ansi.dim(row)}`);
      }
    });

    process.stdout.write(ansi.cursorUp(height));
    process.stdout.write(topBorder + "\n");
    rows.forEach((r) => process.stdout.write(r + "\n"));

    const tag = ` ${" ".repeat(gap)}${ansi.dim(TAGLINE)} ${ansi.dim(`v${VERSION}`)}`;
    process.stdout.write(ansi.clearLine + ansi.dim("─").repeat(bw) + "\n");
    process.stdout.write(ansi.clearLine + tag + "\n");
    process.stdout.write(bottomBorder + "\n");

    await sleep(250);
  }

  // Final reveal with scan line moving across the bottom
  for (let i = 0; i < 8; i++) {
    const scanIdx = Math.floor((Date.now() / 60) % bw);
    const scanLine =
      " ".repeat(scanIdx) + ansi.green("█") + " ".repeat(bw - scanIdx - 1);
    process.stdout.write(ansi.cursorUp(1));
    process.stdout.write(
      ansi.clearLine +
        ` ${ansi.dim("─").slice(0, scanIdx)}${ansi.green("═")}${ansi.dim("─").slice(scanIdx + 1)}` +
        "\n"
    );
    await sleep(80);
  }

  // Final static banner
  const finalRows = HORIZON_ART.map((l) => ` ${ansi.accent(l)}`).join("\n");
  process.stdout.write(ansi.cursorUp(height));
  process.stdout.write(` ${ansi.dim("╭")}${inner}${ansi.dim("╮")}\n`);
  process.stdout.write(finalRows + "\n");
  process.stdout.write(ansi.clearLine + ansi.dim("─").repeat(bw) + "\n");
  process.stdout.write(
    ansi.clearLine +
      ` ${" ".repeat(gap)}${ansi.dim(TAGLINE)} ${ansi.dim(`v${VERSION}`)}` +
      "\n"
  );
  process.stdout.write(` ${ansi.dim("╰")}${inner}${ansi.dim("╯")}\n`);

  process.stdout.write(ansi.showCursor);
  await sleep(1200);
}

// ── 3. ASSEMBLE — block-build reveal ────────────────────────────────────

async function demoAssemble() {
  label("Version 3: ASSEMBLE");
  await sleep(400);

  // Letter column boundaries in the ASCII art
  // H: cols 0-9,  O1: 11-19,  O2: 21-27,  X: 29-38
  const letterCols = [
    { name: "H", start: 0, end: 9 },
    { name: "O", start: 11, end: 19 },
    { name: "O", start: 21, end: 27 },
    { name: "X", start: 29, end: 38 },
  ];

  process.stdout.write(ansi.hideCursor);

  // Frame 0: empty scaffold — show dots where letters will be
  const scaffold = LEGACY_ART.map((row) => {
    return row
      .split("")
      .map((ch, ci) => {
        const inLetter = letterCols.some((l) => ci >= l.start && ci <= l.end);
        return inLetter ? ansi.dim("·") : " ";
      })
      .join("");
  });
  console.log(scaffold.map((l) => ` ${l}`).join("\n"));
  console.log();
  await sleep(600);

  // Frames 1-4: progressively reveal each letter (all rows for that letter)
  const height = LEGACY_ART.length + 1;

  for (let lettersDone = 1; lettersDone <= 4; lettersDone++) {
    const frame = LEGACY_ART.map((row) => {
      return row
        .split("")
        .map((ch, ci) => {
          const letterIdx = letterCols.findIndex(
            (l) => ci >= l.start && ci <= l.end
          );
          if (letterIdx === -1) return " ";
          if (letterIdx < lettersDone) {
            // This letter is fully revealed — bright
            return ansi.accent(ch);
          }
          // Not yet assembled — dim dot
          return ansi.dim("·");
        })
        .join("");
    });

    process.stdout.write(ansi.cursorUp(height));
    process.stdout.write(frame.map((l) => ` ${l}`).join("\n") + "\n");

    // Show which letters are built
    const status = letterCols
      .map((l, idx) => (idx < lettersDone ? ansi.green("█") : ansi.dim("░")))
      .join(" ");
    process.stdout.write(
      ansi.clearLine + `  ${ansi.dim("build:")} ${status}\n`
    );

    await sleep(350);
  }

  // Hold final assembled state for a moment
  await sleep(300);

  // Now add the border and tagline
  const final = LEGACY_ART.map((l) => ` ${ansi.heading(l)}`).join("\n");
  const bw = 52;
  const line = ansi.dim("─").repeat(bw - 2);
  const top = ` ${ansi.dim("┌")}${ansi.dim("─").repeat(bw - 2)}${ansi.dim("┐")}`;
  const bottom = ` ${ansi.dim("└")}${ansi.dim("─").repeat(bw - 2)}${ansi.dim("┘")}`;
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${ansi.dim(TAGLINE)} ${ansi.dim(`v${VERSION}`)}`;

  process.stdout.write(ansi.cursorUp(height + 1));
  process.stdout.write(top + "\n");
  process.stdout.write(final + "\n");
  process.stdout.write(ansi.clearLine + ` ${line}\n`);
  process.stdout.write(ansi.clearLine + tag + "\n");
  process.stdout.write(bottom + "\n");

  process.stdout.write(ansi.showCursor);
  await sleep(1200);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  console.log(`\n${ansi.boldCyan("  Hoox CLI — Animated Banner Showcase")}`);
  console.log(ansi.dim("  ───────────────────────────────────────\n"));

  await demoPulse();
  await demoRadar();
  await demoAssemble();

  console.log(`\n${ansi.green("  ✓")} All 3 versions shown.`);
  console.log(
    ansi.dim(
      "  Edit tmp/animated-banners.ts to tweak timing, colors, or frames.\n"
    )
  );
}

main().catch(console.error);
