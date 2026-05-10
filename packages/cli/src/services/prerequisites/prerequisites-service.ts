/**
 * PrerequisitesService checks runtime prerequisites before dev commands.
 *
 * Currently checks wrangler version against a known minimum.
 */

interface WranglerVersionCheck {
  outdated: boolean;
  current?: string;
  minimum?: string;
}

export class PrerequisitesService {
  private readonly MINIMUM_WRANGLER = "3.88.0";

  /**
   * Check if wrangler is installed and meets the minimum version.
   *
   * Returns `{ outdated: true }` when wrangler is found but below minimum.
   * Returns `{ outdated: false }` when version meets or exceeds minimum.
   * Returns `{ outdated: false }` when wrangler is not installed (advisory only).
   */
  async checkWranglerVersion(): Promise<WranglerVersionCheck> {
    try {
      const proc = Bun.spawn(["wrangler", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        // wrangler not found or error — advisory, don't block
        return { outdated: false };
      }

      // wrangler --version output: "wrangler 3.87.0" or "3.87.0"
      const raw = stdout.trim();
      const match = raw.match(/(\d+\.\d+\.\d+)/);
      if (!match) {
        return { outdated: false };
      }

      const current = match[1];
      const meetsMin = this.satisfies(current, this.MINIMUM_WRANGLER);

      return {
        outdated: !meetsMin,
        current,
        minimum: this.MINIMUM_WRANGLER,
      };
    } catch {
      // wrangler not installed — advisory, don't block
      return { outdated: false };
    }
  }

  /**
   * Simple semver satisfies check: "3.87.0" satisfies "3.88.0" is false.
   * Returns true if `current >= minimum`.
   */
  private satisfies(current: string, minimum: string): boolean {
    const a = current.split(".").map(Number);
    const b = minimum.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
      if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
    }
    return true;
  }
}
