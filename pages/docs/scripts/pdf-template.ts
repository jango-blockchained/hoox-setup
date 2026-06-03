/**
 * pdf-template.ts — HTML Template & CSS for PDF Generation
 *
 * Generates a complete HTML document with embedded CSS and fonts
 * that matches the Hoox docs site design system. The HTML is rendered
 * by Puppeteer to produce professionally styled PDFs.
 *
 * Design tokens match pages/docs/src/styles/globals.css:
 *   - Dark navy cover page background
 *   - IBM Plex Sans Variable for body text
 *   - IBM Plex Mono for code blocks
 *   - Bebas Neue for headings
 *   - Amber/gold accent color (oklch 0.7 0.2 45)
 *   - One Dark Pro syntax highlighting
 */

import { generateFontFaceCSS } from "./font-loader.ts";
import type { SectionHtml } from "./markdown-processor.ts";

// ── PDF Page Dimensions (A4) ─────────────────────────────────────────────────

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 20;

// ── CSS Styles ─────────────────────────────────────────────────────────────────

function getCss(fontsCss: string): string {
  return `
/* ── Font Faces (base64 embedded) ── */
${fontsCss}

/* ── @page Rules (A4 with 20mm margins) ── */
@page {
  size: A4;
  margin: 20mm;
}

@page:first {
  margin: 0;
}

/* ── CSS Reset & Base ── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 11pt;
  line-height: 1.6;
  color: oklch(0.15 0 0); /* --foreground light */
  background: oklch(0.97 0 0); /* --background light */
}

body {
  font-family: "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif;
  font-weight: 400;
  max-width: 100%;
}

/* ── Cover Page ── */
.cover-page {
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  background: oklch(0.08 0 0); /* --background dark */
  color: oklch(0.95 0 0); /* --foreground dark */
  padding: 60mm 30mm;
  position: relative;
}

.cover-page::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6mm;
  background: oklch(0.7 0.2 45); /* --accent amber/gold */
}

.cover-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 48pt;
  letter-spacing: 0.05em;
  line-height: 1.1;
  margin-bottom: 8mm;
  color: oklch(0.95 0 0);
}

.cover-subtitle {
  font-family: "IBM Plex Sans Variable", sans-serif;
  font-size: 14pt;
  font-weight: 300;
  color: oklch(0.7 0.2 45); /* --accent */
  margin-bottom: 20mm;
  letter-spacing: 0.02em;
}

.cover-meta {
  font-family: "IBM Plex Mono", monospace;
  font-size: 9pt;
  color: oklch(0.68 0 0); /* --muted-foreground */
  line-height: 1.8;
}

.cover-meta span {
  display: block;
}

/* ── Table of Contents ── */
.toc-page {
  page-break-after: always;
  padding: 0;
}

.toc-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 28pt;
  color: oklch(0.15 0 0);
  letter-spacing: 0.05em;
  margin-bottom: 8mm;
  padding-bottom: 3mm;
  border-bottom: 2px solid oklch(0.7 0.2 45); /* --accent */
}

.toc-list {
  list-style: none;
  padding: 0;
}

.toc-list li {
  font-family: "IBM Plex Sans Variable", sans-serif;
  font-size: 10pt;
  padding: 2mm 0;
  border-bottom: 1px solid oklch(0.92 0 0); /* --muted light */
  color: oklch(0.15 0 0);
}

.toc-list li .toc-section {
  font-weight: 600;
  color: oklch(0.65 0.2 45); /* --accent light */
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Content Sections ── */
.section {
  page-break-before: always;
  padding: 0;
}

.section:first-of-type {
  page-break-before: auto;
}

.section-header {
  border-bottom: 3px solid oklch(0.7 0.2 45); /* --accent */
  padding-bottom: 3mm;
  margin-bottom: 6mm;
}

.section-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: 24pt;
  color: oklch(0.15 0 0);
  letter-spacing: 0.03em;
  line-height: 1.2;
}

.section-source {
  font-family: "IBM Plex Mono", monospace;
  font-size: 8pt;
  color: oklch(0.55 0 0); /* --muted-foreground light */
  margin-top: 1mm;
}

/* ── Typography ── */
h1 {
  font-family: "Bebas Neue", sans-serif;
  font-size: 28pt;
  color: oklch(0.15 0 0);
  letter-spacing: 0.03em;
  margin-top: 10mm;
  margin-bottom: 4mm;
  line-height: 1.2;
}

h2 {
  font-family: "Bebas Neue", sans-serif;
  font-size: 20pt;
  color: oklch(0.15 0 0);
  letter-spacing: 0.02em;
  margin-top: 8mm;
  margin-bottom: 3mm;
  line-height: 1.3;
}

h3 {
  font-family: "IBM Plex Sans Variable", sans-serif;
  font-size: 14pt;
  font-weight: 600;
  color: oklch(0.15 0 0);
  margin-top: 6mm;
  margin-bottom: 2mm;
}

h4, h5, h6 {
  font-family: "IBM Plex Sans Variable", sans-serif;
  font-size: 11pt;
  font-weight: 600;
  color: oklch(0.15 0 0);
  margin-top: 4mm;
  margin-bottom: 2mm;
}

p {
  margin-bottom: 3mm;
  line-height: 1.6;
}

a {
  color: oklch(0.65 0.2 45); /* --accent light */
  text-decoration: none;
}

strong {
  font-weight: 600;
}

/* ── Lists ── */
ul, ol {
  margin-bottom: 3mm;
  padding-left: 6mm;
}

li {
  margin-bottom: 1mm;
}

/* ── Code Blocks (Shiki one-dark-pro) ── */
pre {
  background: #282c34;
  border-radius: 4mm;
  padding: 4mm;
  margin-bottom: 4mm;
  overflow-x: auto;
  font-size: 8.5pt;
  line-height: 1.5;
}

pre code {
  font-family: "IBM Plex Mono", monospace;
  font-size: 8.5pt;
  color: #abb2bf;
}

/* Inline code */
code {
  font-family: "IBM Plex Mono", monospace;
  font-size: 9.5pt;
  background: oklch(0.92 0 0); /* --muted light */
  padding: 0.5mm 1.5mm;
  border-radius: 1mm;
  color: oklch(0.65 0.2 45); /* --accent */
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}

/* ── Tables ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4mm;
  font-size: 9.5pt;
}

th {
  background: oklch(0.92 0 0); /* --muted light */
  font-weight: 600;
  text-align: left;
  padding: 2mm 3mm;
  border-bottom: 2px solid oklch(0.7 0.2 45); /* --accent */
}

td {
  padding: 2mm 3mm;
  border-bottom: 1px solid oklch(0.92 0 0);
}

tr:nth-child(even) td {
  background: oklch(0.97 0 0);
}

/* ── Callout / Admonition Boxes ── */
.callout {
  border-radius: 2mm;
  padding: 3mm 4mm;
  margin-bottom: 4mm;
  border-left: 3px solid;
}

.callout-tip {
  background: oklch(0.95 0.08 142.5); /* greenish */
  border-left-color: oklch(0.62 0.19 142.5); /* --success */
}

.callout-warning {
  background: oklch(0.95 0.06 80); /* yellowish */
  border-left-color: oklch(0.8 0.15 80); /* --warning */
}

.callout-note {
  background: oklch(0.95 0.02 240); /* bluish */
  border-left-color: oklch(0.55 0.12 240);
}

.callout-danger {
  background: oklch(0.95 0.06 27); /* reddish */
  border-left-color: oklch(0.577 0.245 27.325); /* --destructive */
}

.callout-caution {
  background: oklch(0.95 0.06 60); /* orangeish */
  border-left-color: oklch(0.65 0.2 45); /* --accent */
}

.callout-info {
  background: oklch(0.95 0.02 240); /* bluish */
  border-left-color: oklch(0.55 0.12 240);
}

.callout-title {
  font-weight: 600;
  font-size: 10pt;
  margin-bottom: 1mm;
}

.callout-content {
  font-size: 9.5pt;
  line-height: 1.5;
}

.callout-content p {
  margin-bottom: 1mm;
}

/* ── Blockquotes ── */
blockquote {
  border-left: 3px solid oklch(0.7 0.2 45); /* --accent */
  padding-left: 4mm;
  margin: 3mm 0;
  color: oklch(0.55 0 0); /* --muted-foreground light */
  font-style: italic;
}

/* ── Horizontal Rules ── */
hr {
  border: none;
  border-top: 1px solid oklch(0.87 0 0); /* --border light */
  margin: 6mm 0;
}

/* ── Mermaid Diagrams ── */
.mermaid {
  background: oklch(0.95 0 0);
  border: 1px solid oklch(0.87 0 0);
  border-radius: 2mm;
  padding: 4mm;
  margin-bottom: 4mm;
  text-align: center;
  font-family: "IBM Plex Sans Variable", sans-serif;
  font-size: 9pt;
}

/* ── Task Lists ── */
.contains-task-list {
  list-style: none;
  padding-left: 2mm;
}

.task-list-item {
  position: relative;
  padding-left: 5mm;
  margin-bottom: 1mm;
}

.task-list-item-checkbox {
  margin-right: 2mm;
  vertical-align: middle;
}

/* ── Footnotes ── */
.footnotes {
  font-size: 8.5pt;
  color: oklch(0.55 0 0);
  border-top: 1px solid oklch(0.87 0 0);
  margin-top: 6mm;
  padding-top: 3mm;
}

.footnotes ol {
  padding-left: 4mm;
}

.footnotes li {
  margin-bottom: 0.5mm;
}

/* ── Print Optimization ── */
@media print {
  .section {
    page-break-before: always;
  }

  h1, h2, h3 {
    page-break-after: avoid;
  }

  pre, table, .callout {
    page-break-inside: avoid;
  }

  img, svg {
    max-width: 100%;
  }
}
`;
}

// ── Public CSS Generator ────────────────────────────────────────────────────────

/**
 * Generate the full CSS stylesheet for PDF rendering.
 * Includes @font-face declarations, @page rules, typography,
 * code blocks, tables, callouts, and print media queries.
 */
export function generatePdfCss(): string {
  const fontsCss = generateFontFaceCSS();
  return getCss(fontsCss);
}

// ── HTML Document Builder ──────────────────────────────────────────────────────

export interface PdfTemplateOptions {
  /** Document title (e.g., "End-User Workspace & Client Operations Manual") */
  title: string;
  /** Subtitle for the cover page */
  subtitle?: string;
  /** Sections with pre-rendered HTML content */
  sections: SectionHtml[];
  /** Generation date (defaults to today) */
  date?: string;
  /** Classification label */
  classification?: string;
}

/**
 * Build a complete HTML document for PDF generation.
 * Includes embedded fonts, CSS, and mermaid.js for diagram rendering.
 */
export function buildHtmlDocument(options: PdfTemplateOptions): string {
  const {
    title,
    subtitle = "",
    sections,
    date = new Date().toISOString().split("T")[0],
    classification = "Technical Documentation",
  } = options;

  const fontsCss = generateFontFaceCSS();
  const css = getCss(fontsCss);

  // Build Table of Contents
  const tocItems = sections
    .map(
      (s) => `
    <li>
      <span class="toc-section">${s.source.split("/")[0]}</span><br/>
      ${s.title}
    </li>`
    )
    .join("\n");

  // Build content sections
  const contentSections = sections
    .map(
      (s) => `
  <div class="section">
    <div class="section-header">
      <div class="section-title">${s.title}</div>
      <div class="section-source">${s.source}</div>
    </div>
    ${s.html}
  </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-title">HOOX</div>
    <div class="cover-subtitle">${title.toUpperCase()}</div>
    <div class="cover-meta">
      <span>Generated: ${date}</span>
      <span>Classification: ${classification}</span>
      <span>Version: ${date}</span>
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-page">
    <div class="toc-title">TABLE OF CONTENTS</div>
    <ul class="toc-list">
      ${tocItems}
    </ul>
  </div>

  <!-- Content Sections -->
  ${contentSections}

  <!-- Mermaid.js for diagram rendering -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#d4a843',
        primaryTextColor: '#e8e8e8',
        primaryBorderColor: '#555',
        lineColor: '#888',
        secondaryColor: '#2d2d2d',
        tertiaryColor: '#1a1a2e',
        fontFamily: 'IBM Plex Sans Variable, sans-serif',
        fontSize: '12px'
      }
    });
  </script>
</body>
</html>`;
}
