/**
 * Global Hoox runtime — managed clone of hoox-setup under $HOME/.hoox/repo.
 *
 * Used when the CLI runs outside a local monorepo checkout (e.g. `hx tui`
 * from an unrelated project). Bootstrap clones + installs dependencies.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  getHooxHome,
  getHooxRepoPath,
  getTuiEntryCandidates,
  isHooxSetupRoot,
  resolveHooxRuntimeRoot,
  type RuntimeRootResult,
} from "@jango-blockchained/hoox-shared";

/** Default public monorepo URL for the managed global runtime. */
export const DEFAULT_HOOX_SETUP_REPO =
  "https://github.com/jango-blockchained/hoox-setup.git";

export interface RuntimeStatus {
  hooxHome: string;
  repoPath: string;
  runtime: RuntimeRootResult;
  tuiEntry: string | null;
  repoPresent: boolean;
  isSetupRoot: boolean;
}

export interface EnsureRuntimeOptions {
  /** Git remote (default: jango-blockchained/hoox-setup). */
  repoUrl?: string;
  /** Skip `bun install` after clone (tests / offline). */
  skipInstall?: boolean;
  /** Called with human-readable progress lines. */
  onLog?: (message: string) => void;
}

export interface EnsureRuntimeResult {
  repoPath: string;
  cloned: boolean;
  installed: boolean;
  tuiEntry: string | null;
}

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Snapshot of runtime resolution + TUI entry for doctor / errors. */
export function getRuntimeStatus(cwd: string = process.cwd()): RuntimeStatus {
  const runtime = resolveHooxRuntimeRoot({ cwd });
  const repoPath = getHooxRepoPath();
  const tuiEntry = runtime.root
    ? firstExisting(getTuiEntryCandidates(runtime.root))
    : null;

  return {
    hooxHome: getHooxHome(),
    repoPath,
    runtime,
    tuiEntry,
    repoPresent: existsSync(repoPath),
    isSetupRoot: isHooxSetupRoot(repoPath),
  };
}

async function runCommand(
  cmd: string[],
  cwd: string
): Promise<{ ok: boolean; stderr: string; stdout: string }> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, stdout, stderr };
}

/**
 * Ensure `$HOME/.hoox/repo` is a usable hoox-setup clone.
 * Clones shallow if missing; runs `bun install` when needed.
 */
export async function ensureGlobalRuntime(
  options: EnsureRuntimeOptions = {}
): Promise<EnsureRuntimeResult> {
  const log = options.onLog ?? (() => {});
  const repoUrl = options.repoUrl ?? DEFAULT_HOOX_SETUP_REPO;
  const repoPath = getHooxRepoPath();
  const hooxHome = getHooxHome();

  await mkdir(hooxHome, { recursive: true });

  let cloned = false;
  if (!isHooxSetupRoot(repoPath)) {
    if (existsSync(repoPath)) {
      throw new Error(
        `Path exists but is not a hoox-setup monorepo: ${repoPath}\n` +
          `  Remove it or set HOOX_REPO to a valid checkout, then retry.`
      );
    }
    log(`Cloning ${repoUrl} → ${repoPath}`);
    const parent = hooxHome;
    const clone = await runCommand(
      ["git", "clone", "--depth", "1", repoUrl, repoPath],
      parent
    );
    if (!clone.ok) {
      throw new Error(
        `git clone failed:\n${clone.stderr || clone.stdout}`.trim()
      );
    }
    cloned = true;
  } else {
    log(`Runtime already present: ${repoPath}`);
  }

  let installed = false;
  if (!options.skipInstall) {
    const nodeModules = join(repoPath, "node_modules");
    const tuiPkg = join(repoPath, "packages", "tui", "package.json");
    const needsInstall =
      !existsSync(nodeModules) ||
      (existsSync(tuiPkg) &&
        !existsSync(join(repoPath, "packages", "tui", "node_modules")) &&
        !existsSync(join(nodeModules, "@opentui")));

    // Always install after a fresh clone; otherwise only if deps look missing.
    if (cloned || needsInstall || !existsSync(nodeModules)) {
      log(`Running bun install in ${repoPath}`);
      const install = await runCommand(["bun", "install"], repoPath);
      if (!install.ok) {
        throw new Error(
          `bun install failed:\n${install.stderr || install.stdout}`.trim()
        );
      }
      installed = true;
    }
  }

  const tuiEntry = firstExisting(getTuiEntryCandidates(repoPath));
  return { repoPath, cloned, installed, tuiEntry };
}
