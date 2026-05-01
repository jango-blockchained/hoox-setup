### Managing Logs

Download the latest logs for a given worker from the R2 system logs bucket:

```bash
hoox logs download trade-worker
```

### Bun Installation Safety Flow

When `hoox` installs Bun, it now uses a safer non-piped execution flow:

1. Download the installer script from `https://bun.sh/install` into a temporary file.
2. Download the expected SHA-256 checksum from `https://bun.sh/install.sha256`.
3. Compute the SHA-256 checksum of the downloaded installer and compare it to the trusted checksum.
4. Abort with clear warnings if checksum verification fails or cannot be performed.
5. Execute the verified installer file directly with explicit args (`bash <temp-installer> --yes`).
6. Remove temporary installer artifacts after completion.

This avoids `curl ... | bash` and prevents executing unverified installer content.
