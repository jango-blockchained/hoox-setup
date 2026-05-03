### Task 2: Create Shared Metadata File

**Files:**
- Create: `src/app/dashboard/agent/metadata.ts`

- [ ] **Step 1: Create metadata.ts**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agent | Hoox Trading System",
  description:
    "Monitor and control the AI trading agent and risk manager.",
};
```

- [ ] **Step 2: Verify file created**

Run: `ls /home/jango/Git/hoox-setup/pages/dashboard/src/app/dashboard/agent/metadata.ts`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/metadata.ts
git commit -m "feat(dashboard): add agent section metadata file"
```
