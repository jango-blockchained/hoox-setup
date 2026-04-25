# Pynescript

> Parse, analyze, and regenerate TradingView® Pine Script™ with a modern Python toolchain.
> Built-in Language Server Protocol (LSP) for VS Code, Neovim, Zed, and Emacs.

_Pine Script™ and TradingView® are trademarks of TradingView, Inc. This project is an independent effort and is not affiliated with or endorsed by TradingView, Inc._

## Table of Contents

- [Overview](#overview)
- [Language Server (LSP)](#language-server-lsp)
- [Pro API](#pro-api)
- [Features](#features)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Tool Examples](#tool-examples)
- [CLI Reference](#cli-reference)
- [Library API](#library-api)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

## Overview

Pynescript is a Python toolchain for TradingView® Pine Script™ that provides:

- **Parser & AST** — Parse Pine Script into a navigable Python AST
- **LSP Server** — Full language server for professional IDE integration
- **Pro API** — Cloud API for live chart previews and backtests
- **Evaluator** — Run scripts with real or mock market data
- **Linter** — Catch issues before they hit TradingView

## Language Server (LSP)

Get professional IDE features in VS Code, Neovim, Zed, Emacs, and more:

```bash
pip install pynescript[lsp]
pynescript-lsp
```

### Features

| Feature | Description |
|---------|-------------|
| **Diagnostics** | 9 lint rules (naming, deprecated, style) |
| **Autocomplete** | 482 builtins across 20 categories (ta.*, strategy.*, array.*, etc.) |
| **Hover** | Signature, docs, examples, see-also links |
| **Go-to-definition** | Jump to function/type/variable definitions |
| **Find references** | Find all usages of a symbol |
| **Document outline** | Hierarchical symbol tree |
| **Formatting** | Full document + range formatting |

### Editor Setup

**VS Code / Antigravity IDE:**

1. Install the [Pine Script extension](https://marketplace.visualstudio.com/) from the marketplace
2. Open a `.pine` file — the LSP activates automatically

**Neovim (with nvim-lspconfig):**

```lua
require('lspconfig').pynescript.setup({})
```

**Zed:**

Add to `settings.json`:

```json
{
  "language_servers": {
    "pynescript": {
      "command": "pynescript-lsp",
      "arguments": ["--stdio"]
    }
  }
}
```

**Emacs (with lsp-mode):**

```elisp
(use-package lsp-mode
  :hook ((pinescript-mode . lsp))
  :config
  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection '("pynescript-lsp" "--stdio"))
    :major-modes '(pynescript-mode)
    :server-id 'pynescript)))
```

See `clients/` for full configuration guides.

## Pro API

Cloud API for live chart previews and strategy backtesting:

| Endpoint | Description | Tier |
|----------|-------------|------|
| `POST /run` | Execute Pine Script | Free |
| `POST /preview/chart` | Generate chart thumbnail | Pro |
| `POST /preview/indicator` | Indicator chart (SMA, EMA, RSI, MACD) | Pro |
| `POST /backtest/quick` | Quick backtest with equity curve | Pro |

### Pricing

| Tier | Price | API Calls/mo | Features |
|------|-------|-------------|---------|
| Free | $0 | Unlimited (local) | All LSP features |
| Hobby | $9/mo | 5,000 | Live chart previews |
| Pro | $29/mo | 50,000 | + equity curves, backtests |
| Team | $99/mo | 200,000 | + multi-user |

Get an API key at [pynescript.ai](https://pynescript.ai).

### SDK Usage

```python
from pynescript.api import PynescriptAPI

api = PynescriptAPI(api_key="pyn_...")

# Generate chart thumbnail
chart = api.preview.chart(
    data={"close": [100, 101, 102, 101, 103]},
    options={"type": "line", "width": 600, "height": 300}
)
chart.save("chart.png")

# Run quick backtest
result = api.backtest.quick(
    script="//@version=5\nstrategy('My Strategy')",
    mock_data=True,
    mock_bars=252
)
print(f"PnL: {result.summary.total_pnl}")
print(f"Sharpe: {result.summary.sharpe_ratio}")
result.equity_chart.save("equity.png")
```

## Features

- **🔍 Complete Parsing**: Full Pine Script™ v5-v6 grammar via ANTLR4.
- **💻 Language Server**: LSP with autocomplete, diagnostics, hover, navigation.
- **📊 Pro API**: Live chart previews, equity curves, quick backtests.
- **📈 482 Builtins**: ta.*, strategy.*, array.*, matrix.*, math.*, str.*, and more.
- **🛠️ AST Manipulation**: Inspect and transform scripts with Python visitor patterns.
- **🔄 Round-Trip**: Parse and unparse without losing formatting.
- **⚡ Evaluator**: Deterministic expression evaluation with 1000+ tests.
- **📝 Linter**: 9 rules for catching issues before upload.
- **📓 Jupyter Support**: Magic commands for notebook workflows.
- **📊 Data Providers**: Yahoo Finance, Alpha Vantage, CCXT (100+ exchanges).
- **🧪 Battle-Tested**: Regression tests against real TradingView® scripts.
- **🚀 Modern Tooling**: Ruff linting, pytest testing, Nuitka compilation.

## Installation

```bash
# Core library
pip install .

# With LSP support
pip install "pynescript[lsp]"

# Full installation (LSP + dev tools)
pip install -e ".[dev-lsp]"
```

## Quickstart

```python
from pynescript.ast.helper import parse, unparse

script = """
//@version=5
indicator("My RSI")
rsi(close, 14)
"""

tree = parse(script)
regenerated = unparse(tree)
print(regenerated)
```

## Tool Examples

### Parsing and Inspecting AST

```bash
pynescript parse-and-dump examples/rsi_strategy.pine
```

### Round-Trip Formatting

```bash
pynescript parse-and-unparse messy_script.pine > clean_script.pine
```

### Linting

```bash
pynescript lint my_script.pine
pynescript lint --fail-on warnings my_script.pine
```

### Evaluating Expressions

```python
from pynescript.ast.helper import literal_eval

result = literal_eval("1 + 2 * 3")
print(result)  # 7

prices = [100, 102, 101, 103, 105]
rsi = literal_eval(f"ta.rsi({prices}, 9)")
print(rsi)  # ~81.25
```

### Fetching Market Data

```bash
pynescript data AAPL --provider yahoo --period 6mo
pynescript data BTC/USDT --provider ccxt --exchange binance
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `parse-and-dump <file>` | Parse and print AST |
| `parse-and-unparse <file>` | Normalize formatting |
| `lint <file>` | Check for issues |
| `lint --fail-on warnings` | Fail on warnings |
| `data <symbol>` | Fetch market data |
| `lsp` | Start LSP server |

## Library API

```python
# Parse
from pynescript.ast.helper import parse, unparse
tree = parse(source_code)

# Lint
from pynescript.ast.linter import lint_script
warnings = lint_script(source_code)

# Evaluate
from pynescript.ast.helper import literal_eval
result = literal_eval("ta.sma([100, 102, 101], 3)")

# Transform
from pynescript.ast.transformer import NodeTransformer
class Renamer(NodeTransformer):
    def visit_Name(self, node):
        if node.id == "close":
            node.id = "price"
        return node
```

## Project Structure

```
src/pynescript/     # Core: parser, AST, evaluator, linter
  ast/              # ANTLR grammar, ASDL nodes, helpers
  langserver/       # LSP server (diagnostics, completion, hover)
  util/             # Data providers, helpers
backend/            # Pro API server
  api/              # REST endpoints
  services/         # Chart rendering, backtesting
  middleware/       # Auth, rate limiting
clients/            # Editor configs (Neovim, Zed, Emacs, Helix)
scripts/            # Build scripts, metadata generation
tests/              # Test suite
vscode-extension/   # VS Code extension source
```

## Documentation

- [LSP Implementation Plan](./.opencode/plans/pynescript-lsp-implementation.md)
- [GCP Cost Estimate](./docs/gcp_cost_estimate.md)
- [Full Roadmap](./docs/ROADMAP.md)
