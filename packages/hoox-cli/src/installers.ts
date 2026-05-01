import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCommandAsync } from "./utils.js";

const BUN_INSTALLER_URL = "https://bun.sh/install";
const BUN_INSTALLER_CHECKSUM_URL = "https://bun.sh/install.sha256";

type VerificationResult = {
  verified: boolean;
  reason?: string;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "hoox-cli",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`);
  }

  return response.text();
}

function parseChecksum(checksumFileContents: string): string {
  const checksumMatch = checksumFileContents.match(/[a-fA-F0-9]{64}/);
  if (!checksumMatch) {
    throw new Error("Checksum file did not contain a SHA-256 hash");
  }

  return checksumMatch[0].toLowerCase();
}

async function verifyInstallerSha256(installerPath: string): Promise<VerificationResult> {
  try {
    const expectedChecksumContents = await fetchText(BUN_INSTALLER_CHECKSUM_URL);
    const expectedChecksum = parseChecksum(expectedChecksumContents);

    const installerContents = await readFile(installerPath);
    const actualChecksum = createHash("sha256").update(installerContents).digest("hex");

    if (actualChecksum !== expectedChecksum) {
      return {
        verified: false,
        reason: `Checksum mismatch for downloaded Bun installer (expected ${expectedChecksum}, got ${actualChecksum})`,
      };
    }

    return { verified: true };
  } catch (error) {
    return {
      verified: false,
      reason: `Unable to verify Bun installer checksum from trusted source: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function downloadBun(): Promise<void> {
  console.log("Downloading Bun installer...");

  const tempDir = await mkdtemp(join(tmpdir(), "hoox-bun-installer-"));
  const installerPath = join(tempDir, "bun-install.sh");

  try {
    const installerContents = await fetchText(BUN_INSTALLER_URL);
    await writeFile(installerPath, installerContents, { mode: 0o700 });
    await chmod(installerPath, 0o700);

    const verification = await verifyInstallerSha256(installerPath);

    if (!verification.verified) {
      console.warn("⚠️  Bun installer verification failed.");
      if (verification.reason) {
        console.warn(`⚠️  ${verification.reason}`);
      }
      throw new Error("Refusing to execute an unverified Bun installer.");
    }

    console.log("Bun installer checksum verification passed.");
    await runCommandAsync("bash", [installerPath, "--yes"], process.cwd());
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
