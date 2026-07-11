# Build HOOX arXiv paper
#   Full monograph (default): hoox-arxiv-paper.tex
#   Core focused paper (recommended for submission): hoox-arxiv-paper-core.tex
PAPER = hoox-arxiv-paper
CORE_PAPER = hoox-arxiv-paper-core
REPO_ROOT = ..

FIGURE_SRCS = \
	figures/architecture.tex \
	figures/architecture-standalone.tex \
	figures/latency-taxonomy.tex \
	figures/latency-taxonomy-standalone.tex \
	figures/signal-lifecycle.tex \
	figures/signal-lifecycle-standalone.tex \
	figures/agent-cron-lifecycle.tex \
	figures/agent-cron-lifecycle-standalone.tex \
	figures/report-cron-lifecycle.tex \
	figures/report-cron-lifecycle-standalone.tex \
	figures/observability-flow.tex \
	figures/observability-flow-standalone.tex \
	figures/graph-overview.tex \
	figures/graph-overview-standalone.tex

SECTION_SRCS = $(wildcard sections/*.tex)
APPENDIX_SRCS = $(wildcard appendices/*.tex)
LISTING_SRCS = $(wildcard listings/*.ts listings/*.jsonc listings/*.yaml)
GENERATED_SRCS = generated/graph-tables.tex generated/listings-index.tex

.PHONY: all pdf pdf-tikz pdf-core pdf-tikz-core figures listings listings-index graph-tables arxiv-tarball arxiv-tarball-core clean

all: pdf-tikz

pdf: $(PAPER).pdf
	@echo "Built papers/$(PAPER).pdf"

pdf-core: $(CORE_PAPER).pdf
	@echo "Built papers/$(CORE_PAPER).pdf (core version)"

pdf-tikz-core: listings-index graph-tables figures $(CORE_PAPER).pdf
	@echo "Built papers/$(CORE_PAPER).pdf with TikZ figures (core version)"

# Extract code excerpts from monorepo (manifest-driven)
listings:
	bun scripts/extract-listings.ts

# Generate LaTeX listings index from manifest.yaml
generated/listings-index.tex: listings
	bun scripts/generate-listings-index.ts

listings-index: generated/listings-index.tex

# Generate LaTeX tables from graph-metadata.json
graph-tables:
	bun scripts/sync-graph-tables.ts

# Build standalone TikZ figures (requires texlive-pictures)
figures: figures/architecture.pdf figures/latency-taxonomy.pdf \
	figures/signal-lifecycle.pdf figures/agent-cron-lifecycle.pdf \
	figures/report-cron-lifecycle.pdf figures/observability-flow.pdf \
	figures/graph-overview.pdf
	@echo "Built TikZ figures in papers/figures/"

figures/architecture.pdf: figures/architecture-standalone.tex figures/architecture.tex
	cd figures && pdflatex -interaction=nonstopmode architecture-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode architecture-standalone.tex
	mv figures/architecture-standalone.pdf figures/architecture.pdf

figures/latency-taxonomy.pdf: figures/latency-taxonomy-standalone.tex figures/latency-taxonomy.tex
	cd figures && pdflatex -interaction=nonstopmode latency-taxonomy-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode latency-taxonomy-standalone.tex
	mv figures/latency-taxonomy-standalone.pdf figures/latency-taxonomy.pdf

figures/signal-lifecycle.pdf: figures/signal-lifecycle-standalone.tex figures/signal-lifecycle.tex
	cd figures && pdflatex -interaction=nonstopmode signal-lifecycle-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode signal-lifecycle-standalone.tex
	mv figures/signal-lifecycle-standalone.pdf figures/signal-lifecycle.pdf

figures/agent-cron-lifecycle.pdf: figures/agent-cron-lifecycle-standalone.tex figures/agent-cron-lifecycle.tex
	cd figures && pdflatex -interaction=nonstopmode agent-cron-lifecycle-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode agent-cron-lifecycle-standalone.tex
	mv figures/agent-cron-lifecycle-standalone.pdf figures/agent-cron-lifecycle.pdf

figures/report-cron-lifecycle.pdf: figures/report-cron-lifecycle-standalone.tex figures/report-cron-lifecycle.tex
	cd figures && pdflatex -interaction=nonstopmode report-cron-lifecycle-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode report-cron-lifecycle-standalone.tex
	mv figures/report-cron-lifecycle-standalone.pdf figures/report-cron-lifecycle.pdf

figures/observability-flow.pdf: figures/observability-flow-standalone.tex figures/observability-flow.tex
	cd figures && pdflatex -interaction=nonstopmode observability-flow-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode observability-flow-standalone.tex
	mv figures/observability-flow-standalone.pdf figures/observability-flow.pdf

figures/graph-overview.pdf: figures/graph-overview-standalone.tex figures/graph-overview.tex
	cd figures && pdflatex -interaction=nonstopmode graph-overview-standalone.tex
	cd figures && pdflatex -interaction=nonstopmode graph-overview-standalone.tex
	mv figures/graph-overview-standalone.pdf figures/graph-overview.pdf

# arXiv source tarball (requires built PDF)
arxiv-tarball: pdf-tikz
	bun scripts/package-arxiv.ts

# Core paper tarball (builds the core PDF first, then packages)
# Note: the packaging script may need minor updates to handle CORE_PAPER.
arxiv-tarball-core: pdf-tikz-core
	PAPER=$(CORE_PAPER) bun scripts/package-arxiv.ts
	@echo "Core tarball produced (review dist/ contents)"

# Full paper build with pre-rendered TikZ figures
pdf-tikz: listings-index graph-tables figures $(PAPER).pdf
	@echo "Built papers/$(PAPER).pdf with TikZ figures."

$(PAPER).pdf: $(PAPER).tex front-matter.tex macros.tex references.bib \
		$(FIGURE_SRCS) $(SECTION_SRCS) $(APPENDIX_SRCS) $(GENERATED_SRCS) \
		figures/architecture.pdf
	pdflatex -interaction=nonstopmode $(PAPER).tex
	bibtex $(PAPER)
	pdflatex -interaction=nonstopmode $(PAPER).tex
	pdflatex -interaction=nonstopmode $(PAPER).tex

# Core paper (only pulls core sections + light appendices)
$(CORE_PAPER).pdf: $(CORE_PAPER).tex front-matter.tex macros.tex references.bib \
		$(FIGURE_SRCS) sections/01-introduction.tex sections/02-background.tex \
		sections/03-architecture.tex sections/04-mechanisms.tex sections/05-security.tex \
		sections/06-implementation.tex sections/07-evaluation.tex sections/08-related.tex \
		sections/09-limitations.tex sections/10-conclusion.tex \
		generated/graph-tables.tex \
		figures/architecture.pdf
	pdflatex -interaction=nonstopmode $(CORE_PAPER).tex
	bibtex $(CORE_PAPER)
	pdflatex -interaction=nonstopmode $(CORE_PAPER).tex
	pdflatex -interaction=nonstopmode $(CORE_PAPER).tex

clean:
	rm -f $(PAPER).aux $(PAPER).bbl $(PAPER).blg $(PAPER).log $(PAPER).out $(PAPER).pdf missfont.log
	rm -f $(CORE_PAPER).aux $(CORE_PAPER).bbl $(CORE_PAPER).blg $(CORE_PAPER).log $(CORE_PAPER).out $(CORE_PAPER).pdf
	rm -f figures/architecture-standalone.aux figures/architecture-standalone.log
	rm -f figures/architecture-standalone.pdf figures/architecture.pdf
	rm -f figures/latency-taxonomy-standalone.aux figures/latency-taxonomy-standalone.log
	rm -f figures/latency-taxonomy-standalone.pdf figures/latency-taxonomy.pdf
	rm -f figures/signal-lifecycle-standalone.aux figures/signal-lifecycle-standalone.log
	rm -f figures/signal-lifecycle-standalone.pdf figures/signal-lifecycle.pdf
	rm -f figures/agent-cron-lifecycle-standalone.aux figures/agent-cron-lifecycle-standalone.log
	rm -f figures/agent-cron-lifecycle-standalone.pdf figures/agent-cron-lifecycle.pdf
	rm -f figures/report-cron-lifecycle-standalone.aux figures/report-cron-lifecycle-standalone.log
	rm -f figures/report-cron-lifecycle-standalone.pdf figures/report-cron-lifecycle.pdf
	rm -f figures/observability-flow-standalone.aux figures/observability-flow-standalone.log
	rm -f figures/observability-flow-standalone.pdf figures/observability-flow.pdf
	rm -f figures/graph-overview-standalone.aux figures/graph-overview-standalone.log
	rm -f figures/graph-overview-standalone.pdf figures/graph-overview.pdf
	rm -rf dist
	@echo "Cleaned build artifacts (listings/ and generated/ preserved; rerun make listings graph-tables)"