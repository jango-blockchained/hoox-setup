# Security Hardening TODOs

Last updated: 2026-04-21

## Critical

- [x] Add strict internal authentication for `d1-worker` (`/query`, `/batch`, dashboard APIs).
- [x] Require internal authentication on `trade-worker` `/webhook`.
- [x] Protect `agent-worker` admin/control endpoints with internal auth.
- [x] Remove dashboard default credentials and require explicit secrets.

## High

- [x] Gate test/debug endpoints behind an explicit `ENABLE_DEBUG_ENDPOINTS=true` flag (hoox, trade-worker, telegram-worker).
- [x] Verify and enforce webhook signature validation for email provider webhooks.
- [x] Add CSRF protection for dashboard state-changing POST routes.
- [x] Remove raw HTML injection risk in dashboard settings form rendering.
- [ ] Redact sensitive headers/body fields from request/response logs.

## Dependency Risk

- [ ] Upgrade vulnerable runtime dependency chains in `workers/trade-worker` (axios/bybit-api/
      form-data/basic-ftp/serialize-javascript).
- [ ] Upgrade vulnerable chain in `workers/web3-wallet-worker` (`basic-ftp` via puppeteer tree).
- [ ] Upgrade vulnerable chain in `workers/email-worker` (`semver` via imap stack).
- [ ] Refresh remaining lockfiles to clear high/moderate dev-chain advisories where feasible.

## Repo / CI Hardening

- [ ] Pin third-party GitHub Actions to immutable SHAs (replace `@latest`).
- [ ] Reduce CI token permissions to least privilege where possible.
- [ ] Remove/replace placeholder or local plaintext key material from development paths.

## Test Updates

- [x] d1-worker tests: Updated with internal auth tests (10 tests pass)
- [x] trade-worker tests: Updated webhook auth tests (104 tests pass)
- [x] agent-worker tests: Updated with internal auth tests (20 tests pass)
- [x] email-worker tests: Added Mailgun signature verification tests (needs debugging)
- [ ] email-worker tests: FormData Content-Type issue causes Mailgun webhook tests to fail (known issue)

## Completed Work Notes

- Completed: debug endpoint gating, dashboard auth fallback removal.
- Completed: internal auth for d1-worker, trade-worker webhook, agent-worker.
- Completed: Mailgun webhook signature verification.
- Completed: CSRF protection for settings and positions POST routes.
- Completed: HTML escaping in dashboard form rendering.
- Completed: Tests updated for all workers with auth requirements.
