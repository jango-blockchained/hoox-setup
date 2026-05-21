# 📝 Changelog

All notable changes to the Hoox trading platform are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-provider AI Gateway with 5 providers (Workers AI, OpenAI, Anthropic, Google AI, Azure OpenAI)
- Vision analysis endpoint (`/agent/vision`) for chart image analysis
- Reasoning endpoint (`/agent/reasoning`) for advanced strategy audit with o1-class models
- Streaming SSE support for AI chat responses
- Automated PDF portfolio reports via Browser Rendering (twice daily)
- `hoox deploy update-internal-urls` post-deploy command
- `hoox deploy kv-config` command for KV manifest sync
- Detailed CLI troubleshooting runbook in Self-Healing & Repair docs

### Changed
- Upgraded CLI command tree to 15 command groups, 50+ subcommands
- Improved idempotency engine with TTL-based alarm cleanup (24h)
- Enhanced `hoox-tui` with OpenTUI/React 19 and 9-core view architecture
- KV-based rate limiter now persists across cold starts
- Documentation restructured into Enduser Hub + DevOps Manual tracks

### Fixed
- Webhook duplicate detection now handles rapid-fire TradingView retries
- Service binding cold-start race condition resolved with DO mutex lock
- Telegram bot message filtering now strictly validates Chat ID

## [2.0.0] - 2026-05-12

### Added
- Complete monorepo restructure with Bun workspaces
- `web3-wallet-worker` for on-chain DeFi execution (Ethereum/Arbitrum/Polygon)
- `analytics-worker` with Cloudflare Analytics Engine integration
- `report-worker` for automated PDF report generation
- Terminal UI (`./hoox-tui`) — full-screen operations cockpit
- Interactive setup wizard (`hoox init`) with guided onboarding
- Docker Compose support with 3 profiles (workers, dashboard, full)
- Comprehensive test suite: 106 test files, 1,574 assertions
- End-to-end signal flow tests with real Cloudflare infrastructure
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Documentation: 30+ documents covering setup, concepts, operations, API

### Changed
- Migrated from single-worker to 9-microservice architecture
- Webhook validation moved to edge gateway with WAF integration
- Database from in-memory to D1 (globally distributed SQLite)
- Configuration from hardcoded to KV-backed runtime management
- Notification system to dedicated `telegram-worker` with AI chat

### Fixed
- Numerous edge case handling in trade execution pipeline
- Memory leak prevention in Durable Object lifecycle management

## [1.0.0] - 2025-04-26

### Added
- Initial release: single-worker Bybit execution engine
- TradingView webhook signal ingestion
- Basic order placement with HMAC-SHA256 signing
- Telegram notification support
- `hoox` CLI with 5 command groups
- MIT License