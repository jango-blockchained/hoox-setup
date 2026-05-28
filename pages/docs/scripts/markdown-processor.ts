/**
 * markdown-processor.ts — Markdown Parsing & Rendering for PDF Generation
 *
 * Converts markdown content to styled HTML using markdown-it with:
 * - Shiki syntax highlighting (one-dark-pro theme, matching Astro config)
 * - Callout/admonition transforms (Tip, Warning, Note, Danger)
 * - Mermaid diagram passthrough (rendered client-side by mermaid.js)
 * - Footnotes, task lists, and attribute support
 * - YAML frontmatter stripping
 */

import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import attrs from "markdown-it-attrs";
import { createHighlighter, type Highlighter } from "shiki";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SectionHtml {
  /** Section title extracted from frontmatter or first heading */
  title: string;
  /** Source file path relative to docs/ (e.g., "enduser/home.md") */
  source: string;
  /** Rendered HTML content (body only, no wrapper) */
  html: string;
}

// ── Shiki Highlighter (lazy singleton) ────────────────────────────────────────

let _highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (_highlighter) return _highlighter;

  _highlighter = await createHighlighter({
    themes: ["one-dark-pro"],
    langs: [
      "typescript",
      "javascript",
      "json",
      "bash",
      "shell",
      "yaml",
      "toml",
      "sql",
      "css",
      "html",
      "python",
      "rust",
      "go",
    ],
  });

  return _highlighter;
}

// ── Callout Transform ─────────────────────────────────────────────────────────

/**
 * Transform callout/admonition blockquotes into styled HTML divs.
 *
 * Supports two formats:
 *   > **Tip:** This is a tip
 *   > [!TIP] This is a tip
 *
 * Produces:
 *   <div class="callout callout-tip">
 *     <div class="callout-title">💡 Tip</div>
 *     <div class="callout-content">This is a tip</div>
 *   </div>
 */
function transformCallouts(html: string): string {
  // Pattern 1: > **Tip:** content  (markdown-it renders ** as <strong>)
  // Matches: <blockquote><p><strong>Tip:</strong> content</p></blockquote>
  const calloutPattern =
    /<blockquote>\s*<p>\s*<strong>(Tip|Warning|Note|Danger|Caution|Info)\s*:\s*<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi;

  html = html.replace(
    calloutPattern,
    (_match, type: string, content: string) => {
      const normalizedType = type.toLowerCase();
      const emoji = getCalloutEmoji(normalizedType);
      const label = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      return `<div class="callout callout-${normalizedType}">
  <div class="callout-title">${emoji} ${label}</div>
  <div class="callout-content">${content.trim()}</div>
</div>`;
    }
  );

  // Pattern 2: > [!TIP] content  (GitHub-style)
  const githubCalloutPattern =
    /<blockquote>\s*<p>\s*\[!(TIP|WARNING|NOTE|DANGER|CAUTION|INFO)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi;

  html = html.replace(
    githubCalloutPattern,
    (_match, type: string, content: string) => {
      const normalizedType = type.toLowerCase();
      const emoji = getCalloutEmoji(normalizedType);
      const label =
        normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
      return `<div class="callout callout-${normalizedType}">
  <div class="callout-title">${emoji} ${label}</div>
  <div class="callout-content">${content.trim()}</div>
</div>`;
    }
  );

  return html;
}

function getCalloutEmoji(type: string): string {
  const emojis: Record<string, string> = {
    tip: "💡",
    warning: "⚠️",
    note: "📝",
    danger: "🚨",
    caution: "⚡",
    info: "ℹ️",
  };
  return emojis[type] || "📌";
}

// ── Mermaid Passthrough ───────────────────────────────────────────────────────

/**
 * Replace mermaid code blocks with <div class="mermaid"> elements
 * that mermaid.js will render client-side in Puppeteer.
 */
function transformMermaidBlocks(html: string): string {
  // markdown-it renders ```mermaid as <code class="language-mermaid">
  // inside <pre> tags. Replace with mermaid divs.
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code: string) => {
      // Decode HTML entities that markdown-it may have encoded
      const decoded = code
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return `<div class="mermaid">${decoded}</div>`;
    }
  );
}

// ── Markdown-it Instance ──────────────────────────────────────────────────────

async function createMarkdownProcessor(): Promise<MarkdownIt> {
  const highlighter = await getHighlighter();

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    // Shiki-based syntax highlighting
    highlight(code, lang) {
      // Mermaid blocks are handled separately — don't highlight
      if (lang === "mermaid") {
        return `<pre><code class="language-mermaid">${MarkdownIt().utils.escapeHtml(code)}</code></pre>`;
      }

      // Try to highlight with shiki
      const validLang = highlighter.getLoadedLanguages().includes(lang)
        ? lang
        : "text";

      try {
        return highlighter.codeToHtml(code, {
          lang: validLang,
          theme: "one-dark-pro",
        });
      } catch {
        // Fallback: plain text
        return `<pre><code>${MarkdownIt().utils.escapeHtml(code)}</code></pre>`;
      }
    },
  });

  // Plugins
  md.use(footnote);
  md.use(taskLists, { disabled: false });
  md.use(attrs);

  return md;
}

// ── Frontmatter Extraction ─────────────────────────────────────────────────────

/**
 * Strip YAML frontmatter from markdown content.
 * Returns the content without frontmatter.
 */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---/, "").trim();
}

/**
 * Extract the title from YAML frontmatter.
 * Falls back to the first # heading, then to the provided fallback.
 */
export function extractTitle(content: string, fallback: string): string {
  // Try frontmatter first
  const frontmatter = content.match(/^---([\s\S]*?)---/);
  if (frontmatter) {
    const titleMatch = frontmatter[1].match(/title:\s*["']?([^"\n\r']+)["']?/);
    if (titleMatch) return titleMatch[1].trim();
  }

  // Try first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  return fallback;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Process a single markdown string to styled HTML.
 * Includes callout transforms, mermaid passthrough, and syntax highlighting.
 */
export async function processMarkdown(content: string): Promise<string> {
  const md = await createMarkdownProcessor();
  const stripped = stripFrontmatter(content);
  let html = md.render(stripped);

  // Post-processing transforms
  html = transformCallouts(html);
  html = transformMermaidBlocks(html);

  return html;
}

/**
 * Process an array of markdown files into SectionHtml objects.
 * Each file is rendered to HTML with full styling support.
 */
export async function processFiles(
  files: string[],
  docsDir: string
): Promise<SectionHtml[]> {
  const fs = await import("fs");
  const path = await import("path");
  const sections: SectionHtml[] = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: File not found: ${filePath}`);
      continue;
    }

    const rawContent = fs.readFileSync(filePath, "utf-8");
    const title = extractTitle(rawContent, file.split("/").pop() || file);
    const html = await processMarkdown(rawContent);

    sections.push({
      title,
      source: file,
      html,
    });
  }

  return sections;
}
