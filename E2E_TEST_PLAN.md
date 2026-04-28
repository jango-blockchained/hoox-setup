# E2E Testing Plan: @hoox/cli Package

## Overview
This document outlines the end-to-end testing procedure for validating the `@hoox/cli` package from a clean installation to individual command execution.

## Test Environment Setup

```bash
# 1. Create fresh test directory
cd /tmp && rm -rf hoox-e2e-test && mkdir hoox-e2e-test && cd hoox-e2e-test

# 2. Initialize bun project
bun init -y

# 3. Pack the CLI package from source
cd /path/to/hoox-setup/packages/hoox-cli
npm pack

# 4. Install the local package
cd /tmp/hoox-e2e-test
bun add /path/to/hoox-setup/packages/hoox-cli/hoox-cli-0.1.0.tgz
```

## Command-by-Command Testing

### 1. Help Command
```bash
bunx hoox --help
```
**Expected Output:** List of all available commands with descriptions.

### 2. Check-Setup (Without Config)
```bash
bunx hoox check-setup
```
**Expected Output:** Error indicating workers.jsonc is missing.

### 3. Create Test Config
```bash
cat > workers.jsonc << 'EOF'
{
  "global": {
    "cloudflare_api_token": "test_token",
    "cloudflare_account_id": "test_account",
    "cloudflare_secret_store_id": "test_store",
    "subdomain_prefix": "test-hoox"
  },
  "workers": {
    "hoox": {
      "enabled": true,
      "path": "workers/hoox"
    }
  }
}
EOF
cp workers.jsonc workers.jsonc.example
```

### 4. Check-Setup (With Config)
```bash
bunx hoox check-setup
```
**Expected Output:** Validation results showing config is valid but worker directories are missing.

### 5. Workers Clone Command
```bash
# Interactive - answer "all" to clone workers
echo "all" | bunx hoox workers clone --direct
```
**Expected Output:** Progress showing cloning of worker repositories.

### 6. Workers Status Command
```bash
bunx hoox workers status
```
**Expected Output:** Status of enabled/disabled workers.

### 7. Config Command
```bash
bunx hoox config
```
**Expected Output:** Shows which config format is in use.

### 8. Housekeeping Command
```bash
bunx hoox housekeeping --verbose
```
**Expected Output:** Housekeeping check results for all workers.

### 9. Secrets Command
```bash
bunx hoox secrets guide
```
**Expected Output:** Guidance for managing secrets.

### 10. Init Command (Wizard)
```bash
bunx hoox init
```
**Expected Output:** Interactive setup wizard.

## Verification Checklist

- [ ] `bunx hoox --help` displays all commands
- [ ] `bunx hoox check-setup` detects missing config files
- [ ] `bunx hoox check-setup` validates config correctly
- [ ] `bunx hoox workers clone` clones repositories
- [ ] `bunx hoox workers status` shows worker status
- [ ] `bunx hoox config` shows config format
- [ ] `bunx hoox housekeeping` runs checks
- [ ] `bunx hoox secrets guide` displays guidance
- [ ] `bunx hoox init` starts wizard

## Test Results Summary

| Command | Status | Notes |
|---------|--------|-------|
| `--help` | PASS | All commands displayed |
| `check-setup` | PASS | Detects missing/present files |
| `workers clone` | PASS | Clones repos interactively |
| `workers status` | PASS | Shows worker configurations |
| `config` | PASS | Shows config format |
| `housekeeping` | PASS | Runs validation checks |
| `secrets guide` | PASS | Shows guidance |

## Notes

- The `init` command is working but requires interactive input
- Worker directories must exist for `check-setup` to pass fully
- `workers clone` requires user input or piped input for selection
- All core functionality verified working in isolated environment