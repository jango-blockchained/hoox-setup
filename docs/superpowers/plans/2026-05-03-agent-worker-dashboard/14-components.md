### Task 14: Shared Agent Components Index

**Files:**
- Create: `src/components/agent/index.ts`

- [ ] **Step 1: Create index.ts barrel file**

```tsx
export { ChatInterface } from "./chat-interface";
export { VisionUpload } from "./vision-upload";
export { ReasoningPanel } from "./reasoning-panel";
export { ModelConfig } from "./model-config";
export { HealthCheck } from "./health-check";
export { TestModel } from "./test-model";
export { KillSwitch } from "./kill-switch";
export { RiskParameters } from "./risk-parameters";
export { TrailingStops } from "./trailing-stops";
export { UsageChart } from "./usage-chart";
export { UsageTable } from "./usage-table";
```

- [ ] **Step 2: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/components/agent/index.ts
git commit -m "feat(dashboard): add agent components barrel export"
```
