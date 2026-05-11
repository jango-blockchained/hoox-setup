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
    const args = ["compose", "up", "--profile", ...profiles];

    if (detached) {
      args.push("-d");
    }

    try {
      const proc = Bun.spawn(["docker", ...args], {
        cwd: this.cwd,
        stdout: detached ? "pipe" : "inherit",
        stderr: "inherit",
        stdin: "pipe",
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
   */
  async composeDown(): Promise<ComposeResult> {
    try {
      const proc = Bun.spawn(["docker", "compose", "down"], {
        cwd: this.cwd,
        stdout: "pipe",
        stderr: "pipe",
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
   */
  private isCommandAvailable(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = Bun.spawn(["which", cmd.split(" ")[0]!], {
        stdout: "pipe",
        stderr: "pipe",
      });

      proc.exited
        .then((code) => resolve(code === 0))
        .catch(() => resolve(false));
    });
  }
}
