/**
 * DockerService wraps Docker Compose operations for local development.
 *
 * Provides availability checks, compose file detection, and compose up/down.
 */

interface DockerAvailability {
  docker: boolean;
  compose: boolean;
}

interface ComposeResult {
  ok: boolean;
  error?: string;
}

/**
 * Resolved path to docker-compose.yml in the project root.
 */
const COMPOSE_FILE = "docker-compose.yml";

export class DockerService {
  private readonly cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  /**
   * Check if Docker and docker-compose are available in PATH.
   */
  async checkAvailability(): Promise<DockerAvailability> {
    const [dockerOk, composeOk] = await Promise.all([
      this.isCommandAvailable("docker"),
      this.isCommandAvailable("docker compose"),
    ]);

    return { docker: dockerOk, compose: composeOk };
  }

  /**
   * Check if docker-compose.yml exists in the project root.
   */
  async composeFileExists(): Promise<boolean> {
    const file = Bun.file(
      this.cwd.endsWith("/")
        ? `${this.cwd}${COMPOSE_FILE}`
        : `${this.cwd}/${COMPOSE_FILE}`
    );
    return file.exists();
  }

  /**
   * Run `docker compose up` for the given profiles.
   *
   * @param profiles  - Compose profiles to activate (e.g. ["workers", "dashboard"]).
   * @param detached  - Run in detached mode (default false, inherits stdout/stderr).
   * @returns ComposeResult with ok=true on success.
   */
  async composeUp(
    profiles: string[],
    detached = false
  ): Promise<ComposeResult> {
    const args = ["compose", "up"];

    if (detached) {
      args.push("-d");
    }

    const env: Record<string, string> = {};
    if (profiles.length > 0) {
      env.COMPOSE_PROFILES = profiles.join(",");
    }

    try {
      const proc = Bun.spawn(["docker", ...args], {
        cwd: this.cwd,
        stdout: detached ? "pipe" : "inherit",
        stderr: "inherit",
        stdin: "pipe",
        env,
      });

      if (!detached) {
        // For non-detached, inherit stdout/stderr — user sees real-time output.
        // Wait for the process to exit naturally (Ctrl+C or completion).
        const exitCode = await proc.exited;

        if (exitCode === 0) {
          return { ok: true };
        }
        return {
          ok: false,
          error: `docker compose exited with code ${exitCode}`,
        };
      }

      // Detached mode: capture output
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        return { ok: true };
      }
      return {
        ok: false,
        error: stdout.trim() || `docker compose exited with code ${exitCode}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to run docker compose: ${message}` };
    }
  }

  /**
   * Run `docker compose down` to stop running containers.
   *
   * @param profiles  - Compose profiles to target (e.g. ["workers"]). Pass empty array for default.
   */
  async composeDown(profiles: string[] = []): Promise<ComposeResult> {
    const env: Record<string, string> = {};
    if (profiles.length > 0) {
      env.COMPOSE_PROFILES = profiles.join(",");
    }

    try {
      const proc = Bun.spawn(["docker", "compose", "down"], {
        cwd: this.cwd,
        stdout: "pipe",
        stderr: "pipe",
        env,
      });

      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        return { ok: true };
      }
      return {
        ok: false,
        error:
          stderr.trim() || `docker compose down exited with code ${exitCode}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Failed to run docker compose down: ${message}`,
      };
    }
  }

  /**
   * Probe PATH for a command's availability without throwing.
   *
   * When `cmd` contains a space (e.g. "docker compose"), the first token is
   * the binary on PATH and the rest is a subcommand. After confirming the
   * binary is on PATH, we also probe `<binary> <subcommand> version` as a
   * best-effort check that the subcommand is wired up. If the subcommand
   * probe itself errors (e.g. binary crashes, timeout), we fall back to
   * assuming the subcommand exists — modern Docker ships `compose` bundled.
   */
  private isCommandAvailable(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const parts = cmd.split(/\s+/).filter(Boolean);
      const binary = parts[0]!;
      const hasSubcommand = parts.length > 1;

      let proc: ReturnType<typeof Bun.spawn>;
      try {
        proc = Bun.spawn(["which", binary], {
          stdout: "pipe",
          stderr: "pipe",
        });
      } catch {
        // `which` itself unavailable (e.g. minimal Alpine) — treat as not found
        resolve(false);
        return;
      }

      // 5-second timeout: a hung `which` must not block the caller forever
      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // ignore: process may already be dead
        }
        resolve(false);
      }, 5000);

      proc.exited
        .then((code) => {
          clearTimeout(timer);
          if (code !== 0) {
            resolve(false);
            return;
          }
          if (!hasSubcommand) {
            resolve(true);
            return;
          }
          // Best-effort subcommand probe: `<binary> <subcommand> version`.
          // If the spawn or exit promise errors, fall back to `true`
          // (modern Docker ships `compose` bundled with the CLI).
          try {
            const subproc = Bun.spawn([binary, ...parts.slice(1), "version"], {
              stdout: "pipe",
              stderr: "pipe",
            });
            subproc.exited
              .then((subcode) => {
                try {
                  subproc.kill();
                } catch {
                  // ignore
                }
                resolve(subcode === 0);
              })
              .catch(() => resolve(true));
          } catch {
            resolve(true);
          }
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(false);
        });
    });
  }
}
