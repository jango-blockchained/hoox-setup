# Compliance Disclaimers Design

**Date:** 2026-05-07
**Status:** Draft
**Author:** Agent-assisted design

## Overview

Hoox connects to live cryptocurrency exchanges and can execute real trades with real money. Despite operating as open-source educational/research software, the project currently carries no financial disclaimers, regulatory compliance notices, or liability limitation language anywhere in the user-facing surface. This design adds a four-layer compliance coverage system to protect users, contributors, and the project.

Additionally, the LICENSE file is CC BY 4.0 but the README badge incorrectly says MIT — this inconsistency must be corrected.

## Scope

| Layer | Location | Purpose |
|-------|----------|---------|
| 1 | `README.md` | Prominent disclaimer section near the top |
| 2 | `DISCLAIMER.md` (new) | Comprehensive legal disclaimer document |
| 3 | `hoox init` CLI | Interactive risk acknowledgment prompt |
| 4 | Dashboard UI | Persistent footer disclaimer |

---

## Layer 1: README Disclaimer

### Placement

Insert a new `## ⚠️ Disclaimer` section **after** the "Why Hoox?" section and **before** "Enterprise-Grade Features" (between lines 37 and 39).

### Content

```markdown
## ⚠️ Disclaimer

Hoox is provided "as-is" for educational and research purposes only. The authors, contributors,
and copyright holders make no warranties regarding the software and disclaim all liability for
any financial losses resulting from its use.

**No Financial Advice.** Nothing in this repository constitutes financial, investment, or
trading advice. Users are solely responsible for their own trading decisions and must evaluate
all risks independently.

**Risk of Loss.** Algorithmic trading on centralized and decentralized exchanges involves
substantial risk. Past performance is not indicative of future results. You may lose some or
all of your invested capital.

**Regulatory Compliance.** Users are responsible for ensuring compliance with applicable laws
and regulations in their jurisdiction. Trading activities may be subject to licensing
requirements, reporting obligations, or restrictions depending on your location.

**No Warranties.** The software is provided under CC BY 4.0 without warranties of any kind,
express or implied, including but not limited to merchantability, fitness for a particular
purpose, or non-infringement. See the [LICENSE](LICENSE) and [DISCLAIMER](DISCLAIMER.md)
for full details.
```

### License Badge Fix

Line 9: Change `[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)` to `[![License](https://img.shields.io/badge/License-CC%20BY%204.0-green.svg?style=for-the-badge)](https://creativecommons.org/licenses/by/4.0/)`

---

## Layer 2: DISCLAIMER.md

### File: `DISCLAIMER.md` (root)

### Sections

#### 1. No Financial Advice

Hoox is software tooling for automated trading. It does not provide financial advice. Nothing in the source code, documentation, configuration files, user interfaces, or project communications constitutes a recommendation to buy, sell, or hold any asset.

#### 2. Risk Acknowledgment

Algorithmic and automated trading involves significant risk. Users acknowledge that:
- Trading on cryptocurrency exchanges carries the risk of partial or total loss of capital
- Automated systems may execute trades unexpectedly due to software errors, network failures, or misconfigurations
- Market volatility can result in losses exceeding initial investment in leveraged positions
- Past performance of trading strategies does not guarantee future results

#### 3. Limitation of Liability

To the fullest extent permitted by law, the authors, contributors, maintainers, and copyright holders of Hoox shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from the use or inability to use the software, including but not limited to:
- Financial losses, lost profits, or trading losses
- Data loss or corruption
- Unauthorized access to accounts or funds
- Exchange account suspension or termination

#### 4. Regulatory Compliance

Users are solely responsible for ensuring that their use of Hoox complies with all applicable laws, regulations, and licensing requirements in their jurisdiction. This may include but is not limited to:
- Financial services and trading regulations
- Tax reporting obligations
- Export control and sanctions laws
- Cryptocurrency and digital asset regulations

#### 5. Software Provided "As-Is"

The software is provided without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. No guarantee is made that the software will operate without interruption, errors, or security vulnerabilities.

#### 6. Third-Party Services

Hoox integrates with third-party services including but not limited to:
- Cryptocurrency exchanges (Binance, Bybit, MEXC, and others)
- Cloud infrastructure providers (Cloudflare)
- AI/ML service providers (OpenAI, Anthropic, Google, and others)

Users are subject to the terms of service and privacy policies of these third parties. Hoox is not responsible for the actions, failures, or terms of service of any third-party provider.

#### 7. Open Source License

Hoox is licensed under the Creative Commons Attribution 4.0 International License. See the [LICENSE](LICENSE) file for the full license text. The terms of that license apply in addition to this disclaimer.

#### 8. Severability

If any provision of this disclaimer is held to be unenforceable or invalid, the remaining provisions shall continue in full force and effect.

---

## Layer 3: CLI Init Warning

### File: `packages/cli/src/commands/init/init-command.ts`

### Changes

#### 3a. Risk Acknowledgment Prompt

Insert after `p.intro("Hoox Setup Wizard")` (line 429) and before the API token prompt (line 436):

```typescript
const accepted = await p.confirm({
  message:
    'Hoox connects to live trading exchanges and can execute real trades with real money. ' +
    'By continuing, you acknowledge that you are solely responsible for all trading activity ' +
    'and accept the risk of financial loss. Do you accept these terms?',
  initialValue: false,
});

if (accepted === false) {
  p.outro('Setup cancelled.');
  return;
}
```

#### 3b. `--accept-risk` Flag

Add a flag to the init command definition (lines 345-351) to skip the confirmation:

```typescript
.option('--accept-risk', 'skip the risk acknowledgment confirmation')
```

In `runInitCommand()`, check this flag alongside `isNonInteractive`. When `--accept-risk` is set, skip the `p.confirm()` prompt entirely.

```typescript
const skipRiskWarning = opts.acceptRisk || isNonInteractive;
if (!skipRiskWarning) {
  // show p.confirm() prompt
}
```

---

## Layer 4: Dashboard Footer

### File: `pages/dashboard/src/app/dashboard/layout.tsx`

### Changes

Add a footer element after `<main>` and before `<CommandPalette>` (between lines 29 and 30):

```tsx
<footer className="border-t border-border/50 py-2 px-6 text-center text-xs text-muted-foreground">
  Hoox is provided &quot;as-is&quot; for educational purposes only. Not financial advice.
  Trading involves risk of loss. Users are responsible for regulatory compliance in their
  jurisdiction.
</footer>
```

The footer should be styled with `border-t` for visual separation, use `text-muted-foreground` for subtlety, and remain responsive across screen sizes.

---

## Self-Review

1. **Placeholder scan:** No TBD, TODO, or incomplete sections. All content is final.
2. **Internal consistency:** All four layers reference each other appropriately. README links to DISCLAIMER.md. CLI prompt references the same risk language as the disclaimer. Dashboard footer is a condensed version.
3. **Scope check:** Focused on disclaimers only. No unrelated refactoring.
4. **Ambiguity check:**
   - "Educational purposes only" is consistent across all layers
   - Jurisdiction language is intentionally generic (agnostic) per user decision
   - CLI flag behavior is explicitly defined (--accept-risk or --yes/-y)
   - All file locations and line numbers are specified
