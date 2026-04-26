# Hoox Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up unused/orphaned files in src/ folder and fix broken hoox-tui symlink

**Architecture:** Remove dead code files that are not imported anywhere, create symlink for TUI

**Tech Stack:** Bun, TypeScript

---

### Task 1: Remove unused src/types/wrangler.ts

**Files:**
- Remove: `/home/jango/Git/hoox-setup/src/types/wrangler.ts`
- Verify: Check typecheck passes after

- [ ] **Step 1: Remove the file**

```bash
rm /home/jango/Git/hoox-setup/src/types/wrangler.ts
```

- [ ] **Step 2: Verify types folder is empty**

```bash
ls -la /home/jango/Git/hoox-setup/src/types/
```

If empty, remove the directory:
```bash
rmdir /home/jango/Git/hoox-setup/src/types/
```

- [ ] **Step 3: Run typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

---

### Task 2: Remove unused src/utils/tracking.ts

**Files:**
- Remove: `/home/jango/Git/hoox-setup/src/utils/tracking.ts`

- [ ] **Step 1: Remove the file**

```bash
rm /home/jango/Git/hoox-setup/src/utils/tracking.ts
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

---

### Task 3: Remove unused src/utils/route-config.ts

**Files:**
- Remove: `/home/jango/Git/hoox-setup/src/utils/route-config.ts`

- [ ] **Step 1: Remove the file**

```bash
rm /home/jango/Git/hoox-setup/src/utils/route-config.ts
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

---

### Task 4: Remove unused src/utils/route-manager.ts

**Files:**
- Remove: `/home/jango/Git/hoox-setup/src/utils/route-manager.ts`

- [ ] **Step 1: Remove the file**

```bash
rm /home/jango/Git/hoox-setup/src/utils/route-manager.ts
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

---

### Task 5: Remove unused src/utils/worker-definitions.ts

**Files:**
- Remove: `/home/jango/Git/hoox-setup/src/utils/worker-definitions.ts`

- [ ] **Step 1: Remove the file**

```bash
rm /home/jango/Git/hoox-setup/src/utils/worker-definitions.ts
```

- [ ] **Step 2: Run typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

- [ ] **Step 3: Verify remaining utils**

```bash
ls -la /home/jango/Git/hoox-setup/src/utils/
```

Expected remaining: `kvUtils.ts` only

---

### Task 6: Create hoox-tui symlink

**Files:**
- Create: `/home/jango/Git/hoox-setup/hoox-tui` → `src/tui`

- [ ] **Step 1: Create symlink**

```bash
cd /home/jango/Git/hoox-setup && ln -s src/tui hoox-tui
```

- [ ] **Step 2: Verify symlink**

```bash
ls -la /home/jango/Git/hoox-setup/hoox-tui
```

Expected: `hoox-tui -> src/tui`

- [ ] **Step 3: Verify TUI works**

```bash
cd /home/jango/Git/hoox-setup && ./hoox-tui --help 2>&1 | head -5
```

---

### Task 7: Final verification

**Files:**
- Verify: All changes

- [ ] **Step 1: Run full typecheck**

```bash
cd /home/jango/Git/hoox-setup && bun run typecheck
```

- [ ] **Step 2: List remaining src/ structure**

```bash
find /home/jango/Git/hoox-setup/src -type f -name "*.ts"
```

Expected:
```
src/index.ts
src/utils/kvUtils.ts
src/tui/app.js
src/tui/services/WorkerService.js
```

---

## Summary

| File/Folder | Action |
|-------------|--------|
| `src/types/wrangler.ts` | REMOVE |
| `src/utils/tracking.ts` | REMOVE |
| `src/utils/route-config.ts` | REMOVE |
| `src/utils/route-manager.ts` | REMOVE |
| `src/utils/worker-definitions.ts` | REMOVE |
| `hoox-tui` (symlink) | CREATE → src/tui |
| Keep: `src/index.ts`, `src/utils/kvUtils.ts`, `src/tui/` | KEEP |