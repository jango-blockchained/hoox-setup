# arXiv Submission Metadata — HOOX Paper

Use this document when submitting at [https://arxiv.org/submit](https://arxiv.org/submit).  
Primary LaTeX source (core, recommended): `hoox-arxiv-paper-core.tex`
Full monograph source: `hoox-arxiv-paper.tex`
+ `references.bib` + `figures/`.

---

## Submission type

- **New submission** (cs)
- **Format:** PDF + LaTeX source upload

---

## Title

```
HOOX: Edge-Native Low-Latency Algorithmic Trading at the Cloudflare Edge
```

---

## Authors

| Field | Value |
|-------|-------|
| **Author 1** | jango_blockchained |
| **Affiliation** | Independent Researcher |
| **ORCID** | *(add if you have one)* |

---

## Abstract (paste into arXiv form)

Must match `front-matter.tex` exactly. Current text:

```
Algorithmic trading systems have traditionally relied on virtual private servers (VPS) deployed in centralized data centers, incurring substantial network latency, recurring operational cost, and single points of failure. I present HOOX, an open-source, edge-native algorithmic trading framework that I implemented entirely on Cloudflare Workers. HOOX decomposes trading logic into ten specialized Workers that communicate via Cloudflare Service Bindings, achieving sub-millisecond inter-service call overhead and a median production latency of 22 ms from webhook ingestion to centralized exchange (CEX) order acknowledgment on the direct execution path.

I distinguish two measurement regimes that prior summaries often conflate: (i) synthetic fast-path probes, which short-circuit before exchange submission and characterize internal mesh latency; and (ii) production signal-to-ack, which includes HMAC-signed REST placement and exchange response parsing. The system integrates four platform primitives that are uncommon in retail trading stacks: Durable Objects for strongly consistent duplicate suppression under concurrent webhook retries; Smart Placement for automatic proximity routing to exchange API origins; Cloudflare Queues with application-level exponential backoff for outage resilience; and a deterministic risk manager with optional multi-provider large language model (LLM) operational summaries.

Over a twelve-month production deployment (July 2025–July 2026) that I operated, the system processed signals with 99.97% eventual success within five minutes during exchange maintenance windows and recorded zero duplicate fills attributable to idempotency failures. I document the architecture, security model, per-Worker implementation reference with annotated code listings, a multi-tier test methodology and failure taxonomy, and reproducible evaluation commands (hoox perf fastpath with extended hop tracing, hoox trace, k6 load tests; requires hoox-cli v0.9.3+). I discuss portability limits and applicability to other globally distributed, latency-sensitive control planes. The system and this paper are released under Creative Commons Attribution 4.0 (CC BY 4.0).
```

---

## Comments (optional field — recommended)

```
Core paper (recommended): ~15-25 pages focused on architecture + evaluation (includes dramatically extended hop-level measurement data and Smart Placement rationale; requires @jango-blockchained/hoox-cli v0.9.3+).
Full monograph (extended technical reference): ~90+ pages including ADRs, deep dives, complete listings, and full runtime details.
Open source:
https://github.com/jango-blockchained/hoox-setup
Includes ADRs, per-Worker deep dives, D1/R2 data layer, test appendix with
failure taxonomy, and reproducibility commands.
```

---

## Report number (optional)

```
HOOX-2026-001
```

---

## Category

**Primary:**
```
cs.DC
```

**Secondary (cross-list, optional):**
```
cs.SE
```

---

## Files to upload

**Recommendation:** For the initial arXiv submission, use the **core paper** (focused, ~15-20 pages). Upload the full monograph only if you want reviewers to have the complete technical reference in one document.

### Core paper (recommended)

```
hoox-arxiv-paper-core.tex
front-matter.tex
macros.tex
references.bib
sections/01-introduction.tex ... sections/10-conclusion.tex
appendices/A-reproducibility.tex
appendices/C-threat-model.tex
appendices/F-test-excerpts.tex
listings/*   (only the ones actually referenced in core)
generated/graph-tables.tex
figures/*.tex
figures/*.pdf
Makefile
hoox-arxiv-paper-core.pdf
```

### Full monograph (extended version)

```
hoox-arxiv-paper.tex   (includes Sections 11-15 + all appendices)
... (everything above plus the expansion sections and remaining appendices)
hoox-arxiv-paper.pdf
```

### Figure PDFs (pre-built via `make figures`)

```
figures/architecture.pdf
figures/latency-taxonomy.pdf
figures/signal-lifecycle.pdf
figures/agent-cron-lifecycle.pdf
figures/report-cron-lifecycle.pdf
figures/observability-flow.pdf
figures/graph-overview.pdf
```

---

## Build commands before upload

```bash
cd papers

# --- Core paper (recommended for submission) ---
make pdf-tikz-core
# or
make listings graph-tables figures && make pdf-core

# Core tarball:
make arxiv-tarball-core

# --- Full monograph ---
make pdf-tikz
# or
make listings graph-tables figures && make pdf

# Full tarball:
make arxiv-tarball
# → papers/dist/hoox-arxiv-submission.tar.gz  (or core equivalent)
```

After building the core, inspect the produced PDF page count and trim any accidentally pulled heavy content.
```

---

## Suggested cover letter snippet

```
I submit a systems/experience paper describing HOOX, an open-source algorithmic trading
framework that I built entirely on Cloudflare Workers. The contribution is architectural:
edge-native microservices using Service Bindings, Durable Object duplicate
suppression, Smart Placement, and a reproducible evaluation methodology that
separates internal fast-path probes from production exchange-ack latency
(median 22 ms on the direct path). The core paper focuses on the architecture,
key mechanisms, security model, and twelve-month operational results. The extended
technical reference (ADRs, per-Worker deep dives, data layer, runtime semantics,
and full listing index) is available in the source repository and as a companion
document. The system has operated continuously since late 2024 and is available under
CC BY 4.0 at https://github.com/jango-blockchained/hoox-setup.
```

---

## Checklist before submit

- [ ] Decide on core vs full (core recommended for most submissions)
- [ ] PDF compiles without errors (`make pdf-tikz-core` or `make pdf-tikz`)
- [ ] All seven TikZ figures render (`make figures`)
- [ ] Source tarball builds for the chosen variant
- [ ] Abstract in front-matter.tex uses first-person ("I") consistently
- [ ] Abstract matches what you paste into the arXiv form exactly
- [ ] `references.bib` included
- [ ] No private keys / internal URLs in the paper
- [ ] Category `cs.DC` (secondary `cs.SE`)
- [ ] Title uses "Edge-Native Low-Latency"
- [ ] Update page count / comments field for the variant you are uploading
- [ ] Consider expanding references.bib with additional academic citations (trading systems, edge computing experience reports) before final submission