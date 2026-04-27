# NPM Publish & Documentation Update Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate publishing `@hoox/cli` and `@hoox/shared` to NPM and GitHub Releases using GitHub Actions. Overhaul all documentation to instruct users to bootstrap their environment via `bunx @hoox/cli clone` instead of manual Git commands.

**Architecture:** A new GitHub Actions workflow (`.github/workflows/publish.yml`) triggered by tag pushes. Documentation updates will standardize the new frictionless startup flow: `bunx @hoox/cli clone` -> `bun install` -> `hoox config setup` -> `hoox init`.

**Tech Stack:** GitHub Actions, Markdown, Bun/NPM.

---

### Task 1: Create GitHub Actions Workflow for Publishing

**Files:**

- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Write the GitHub Actions workflow file**

```yaml
# Create: .github/workflows/publish.yml
name: Publish to NPM and GitHub Releases

on:
  push:
    tags:
      - "v*" # Trigger on tags matching v*, i.e. v0.1.0

jobs:
  publish:
    name: Build, Test, and Publish
    runs-on: ubuntu-latest
    permissions:
      contents: write # Needed for GitHub Releases
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Typecheck
        run: bun run typecheck

      - name: Run Tests
        run: bun test

      - name: Setup Node (for npm publish)
        uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          registry-url: "https://registry.npmjs.org"

      - name: Publish @hoox/shared to NPM
        run: cd packages/shared && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish @hoox/cli to NPM
        run: cd packages/hoox-cli && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add github actions workflow for npm publish and releases"
```

---

### Task 2: Update Root `README.md`

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update the Quick Start section**

Locate the `## 🚀 Quick Start (Deploy in 5 Minutes)` section in `README.md` and replace the first steps with the new `bunx` installation flow:

````markdown
## 🚀 Quick Start (Deploy in 5 Minutes)

```bash
# 1. Bootstrap your environment instantly via npx/bunx
bunx @hoox/cli clone hoox-trading
cd hoox-trading

# 2. Install ultra-fast Bun dependencies and build (requires [Bun](https://bun.sh))
bun install

# 3. Setup configurations
hoox config setup

# 4. Initialize the platform (Interactive CLI Wizard)
hoox init

# 5. Deploy your entire trading empire to the Cloudflare® Edge!
hoox workers deploy
```
````

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update root readme quick start to use bunx installation flow"
````

---

### Task 3: Update Quick Start Guide

**Files:**

- Modify: `docs/getting-started/quick-start.md`

- [ ] **Step 1: Rewrite Step 1 & Step 2**

Replace `Step 1: Clone & Install` in `docs/getting-started/quick-start.md` with:

````markdown
## Step 1: Clone & Install

```bash
# Bootstrap the complete repository via hoox CLI
bunx @hoox/cli clone hoox-setup
cd hoox-setup
bun install
```
````

## Step 2: Initialize

```bash
hoox config setup
hoox init
```

````

- [ ] **Step 2: Commit**

```bash
git add docs/getting-started/quick-start.md
git commit -m "docs: update quick-start guide with bunx clone command"
````

---

### Task 4: Update Installation Guide

**Files:**

- Modify: `docs/getting-started/installation.md`

- [ ] **Step 1: Rewrite Step 1 & Step 2**

In `docs/getting-started/installation.md`, update `Step 1` and `Step 2`:

````markdown
## Step 1: Bootstrap Repository

We recommend utilizing the `@hoox/cli` directly to bootstrap your environment seamlessly without dealing with git submodules manually:

```bash
# Downloads the repo and properly initializes all submodules
bunx @hoox/cli clone my-hoox-app
cd my-hoox-app
```
````

## Step 2: Install Dependencies & Configs

```bash
bun install
hoox config setup
```

````

- [ ] **Step 2: Commit**

```bash
git add docs/getting-started/installation.md
git commit -m "docs: update installation guide with new bootstrap flow"
````

---

### Task 5: Update Installation Flow & Agents Docs

**Files:**

- Modify: `docs/INSTALLATION_FLOW.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update Quick Start in `docs/INSTALLATION_FLOW.md`**

Scroll to `### 13.3 Quick Start` and update it:

````markdown
### 13.3 Quick Start

```bash
# Bootstrap via hoox CLI
bunx @hoox/cli clone hoox-setup
cd hoox-setup

# Install dependencies and setup configs
bun install
hoox config setup

# Run setup wizard
hoox init

# Deploy
hoox workers deploy
```
````

````

- [ ] **Step 2: Update Quick Start in `AGENTS.md`**

Scroll to `### 13.3 Quick Start` in `AGENTS.md` and make the exact same replacement as Step 1.

- [ ] **Step 3: Commit**

```bash
git add docs/INSTALLATION_FLOW.md AGENTS.md
git commit -m "docs: update comprehensive reference docs with new setup flow"
````
