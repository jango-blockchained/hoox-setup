<!-- Context: project-intelligence/guides | Priority: high | Version: 1.0 | Updated: 2026-05-03 -->

# Local Development

**Concept**: Run workers locally with `hoox workers dev <name>` or `bunx wrangler dev` on assigned ports.

## Quick Start
```bash
bun install
cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars
hoox workers dev hoox          # port 8787
```

## Local Ports
| Service | Port |
|---------|------|
| hoox | 8787 |
| trade-worker | 8788 |
| d1-worker | 8789 |
| telegram-worker | 8790 |
| web3-wallet | 8792 |
| dashboard | 3000 |

## Commands
```bash
hoox workers dev dashboard    # Next.js dashboard
bun run dev                  # Single worker (in worker dir)
./hoox-tui                  # TUI for all workers
```

## Dashboard (Next.js)
```bash
cd pages/dashboard && bun run dev
# Uses @opennextjs/cloudflare, runtime: "edge"
```

## 📂 Codebase References
**Local dev doc**: `docs/development/local-dev.md`
**CLI**: `packages/hoox-cli/` - `hoox workers dev` command
