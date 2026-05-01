# @hoox/cli

Official CLI for Hoox infrastructure workflows on Cloudflare.

## Install

```bash
bun add -g @hoox/cli
# or run once without installing globally
bunx @hoox/cli --help
```

## Usage

```bash
hoox --help
hoox workers deploy
hoox pages deploy
hoox logs download trade-worker
```

## Development

From repo root:

```bash
bun run --cwd packages/hoox-cli lint
bun run --cwd packages/hoox-cli typecheck
bun run --cwd packages/hoox-cli test
```

## Release process (GitHub + npm)

1. Bump version in `packages/hoox-cli/package.json`.
2. Ensure checks pass:
   - `bun run --cwd packages/hoox-cli lint`
   - `bun run --cwd packages/hoox-cli typecheck`
   - `bun run --cwd packages/hoox-cli test`
3. Commit and tag:
   - `git commit -am "release(hoox-cli): vX.Y.Z"`
   - `git tag hoox-cli-vX.Y.Z`
   - `git push && git push --tags`
4. Publish to npm:
   - `cd packages/hoox-cli && npm publish --access public`
5. Create a GitHub Release from tag `hoox-cli-vX.Y.Z` with release notes.

## Security note

When `hoox` installs Bun, it uses a non-piped verification flow:

1. Downloads the installer script to a temporary file.
2. Downloads expected SHA-256 checksum.
3. Verifies checksum before execution.
4. Executes only if checksum matches.
5. Removes temporary artifacts.

This avoids `curl ... | bash` execution patterns.
