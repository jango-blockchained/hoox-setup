import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Derive __dirname cleanly under ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define project roots
const repoRoot = path.resolve(__dirname, "../../..");
const docsDir = path.join(repoRoot, "docs");
const publicDir = path.join(repoRoot, "pages/docs/public");

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// ── Define Logical File Ingest Order ──

const enduserFiles = [
  "enduser/home.md",
  "enduser/getting-started/installation.md",
  "enduser/getting-started/configuration.md",
  "enduser/getting-started/quick-start.md",
  "enduser/concepts/how-hoox-works.md",
  "enduser/concepts/edge-architecture.md",
  "enduser/concepts/cloudflare-services.md",
  "enduser/concepts/idempotency.md",
  "enduser/concepts/signals-and-trades.md",
  "enduser/concepts/ai-risk-manager.md",
  "enduser/guides/local-development.md",
  "enduser/guides/tui.md",
  "enduser/guides/database-ops.md",
  "enduser/guides/secrets-security.md",
  "enduser/guides/manage-infra.md",
  "enduser/guides/deploy-workers.md",
  "enduser/guides/repair.md",
  "enduser/tutorials/tradingview-webhook.md",
  "enduser/tutorials/telegram-bot.md",
  "enduser/tutorials/email-signals.md",
  "enduser/reference/cli-commands.md",
  "enduser/reference/api-endpoints.md",
  "enduser/reference/configuration.md",
];

const devopsFiles = [
  "devops/home.md",
  "devops/setup-and-operations.md",
  "devops/installation-flow.md",
  "devops/tui.md",
  "devops/architecture/overview.md",
  "devops/architecture/communication.md",
  "devops/architecture/data-flow.md",
  "devops/architecture/bindings.md",
  "devops/architecture/storage.md",
  "devops/architecture/endpoints.md",
  "devops/architecture/design-system.md",
  "devops/workers/hoox.md",
  "devops/workers/trade-worker.md",
  "devops/workers/agent-worker.md",
  "devops/workers/telegram-worker.md",
  "devops/workers/d1-worker.md",
  "devops/workers/web3-wallet-worker.md",
  "devops/workers/email-worker.md",
  "devops/workers/analytics-worker.md",
  "devops/workers/report-worker.md",
  "devops/workers/dashboard.md",
  "devops/deployment/production.md",
  "devops/deployment/cicd.md",
  "devops/deployment/monitoring.md",
  "devops/deployment/zero-trust.md",
  "devops/development/local-dev.md",
  "devops/development/testing.md",
  "devops/development/debugging.md",
  "devops/api/endpoints.md",
  "devops/api/payloads.md",
  "devops/api/responses.md",
  "devops/cli-features.md",
];

// Helper to sanitize markdown content
function sanitizeContent(content: string): string {
  // Remove frontmatter
  return content.replace(/^---[\s\S]*?---/, "").trim();
}

// ── NEW: Deep Unicode & Emoji Stripper for jsPDF (Monospace Courier bounds) ──
function cleanForPDF(text: string): string {
  // Strip emojis using unicode-aware regex
  let cleaned = text.replace(/\p{Emoji_Presentation}/gu, "");
  cleaned = cleaned.replace(/\p{Emoji}/gu, "");
  cleaned = cleaned.replace(/\p{Emoji_Modifier_Base}/gu, "");
  cleaned = cleaned.replace(/\p{Emoji_Modifier}/gu, "");
  cleaned = cleaned.replace(/\p{Emoji_Component}/gu, "");
  cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, "");

  // Replace common unicode characters with ASCII equivalents
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // en/em dashes
    .replace(/\u2022/g, "*") // bullet point
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/├/g, "|")
    .replace(/└/g, "|")
    .replace(/│/g, "|")
    .replace(/──►/g, "-->")
    .replace(/─/g, "-")
    .replace(/┌/g, "+")
    .replace(/┐/g, "+")
    .replace(/┘/g, "+")
    .replace(/└/g, "+")
    .replace(/┬/g, "+")
    .replace(/┴/g, "+")
    .replace(/┼/g, "+")
    .replace(/¶/g, "")
    .replace(/§/g, "")
    .replace(/©/g, "(c)")
    .replace(/®/g, "(r)")
    .replace(/™/g, "tm")
    .replace(/€/g, "EUR")
    .replace(/£/g, "GBP");

  // Finally strip any remaining non-ASCII characters to prevent rendering artifacts
  /* eslint-disable-next-line no-control-regex */
  cleaned = cleaned.replace(/[^\x00-\x7F]/g, "");
  return cleaned;
}

// ── NEW: Deep Plain Text Minifier & Compression for LLMs ──
function minifyLlmText(content: string): string {
  // 1. Remove frontmatter
  let text = content.replace(/^---[\s\S]*?---/, "");

  // 2. Remove Mermaid diagram blocks completely
  text = text.replace(/```mermaid[\s\S]*?```/g, "");

  // 3. Strip Markdown link formats: [Text](URL) -> Text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 4. Strip HTML tags (SVG wrappers, HTML badges)
  text = text.replace(/<svg[\s\S]*?<\/svg>/g, "");
  text = text.replace(/<[^>]+>/g, "");

  // 5. Strip Markdown formatting indicators
  text = text.replace(/^#+\s+/gm, ""); // headings
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1"); // bold
  text = text.replace(/\*([^*]+)\*/g, "$1"); // italic
  text = text.replace(/__([^_]+)__/g, "$1"); // bold
  text = text.replace(/_([^_]+)_/g, "$1"); // italic
  text = text.replace(/`([^`]+)`/g, "$1"); // inline code
  text = text.replace(/^\s*[-*+]\s+/gm, ""); // list bullets
  text = text.replace(/^\s*>\s+/gm, ""); // blockquotes
  text = text.replace(/```[a-z]*\n([\s\S]*?)```/g, "$1"); // standard code block wrappers

  // 6. Strip Emojis using unicode-aware regex
  text = text.replace(/\p{Emoji}/gu, "");

  // 7. Compress Whitespace: trim lines, remove empty lines, collapse spaces
  const compressedLines = text
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0);

  return compressedLines.join("\n");
}

// Helper to write a PDF file using jsPDF
function generatePDF(title: string, files: string[], outputPath: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Page dimensions: A4 is 210mm x 297mm
  const margin = 15;
  const contentWidth = 210 - 2 * margin; // 180mm
  let y = 20;

  // Title Page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("HOOX TRADING PLATFORM", margin, 60);
  doc.setFontSize(18);
  doc.setTextColor(100, 100, 100);
  doc.text(cleanForPDF(title.toUpperCase()), margin, 75);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, margin, 95);
  doc.text("Classification: Technical Documentation Spec", margin, 102);
  doc.text("Design Style: Modern Technical Layout", margin, 109);
  doc.setTextColor(0, 0, 0);

  // Table of Contents
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TABLE OF CONTENTS", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const frontmatter = rawContent.match(/^---([\s\S]*?)---/);
    let fileTitle = file.split("/").pop() || "";
    if (frontmatter) {
      const titleMatch = frontmatter[1].match(
        /title:\s*["']?([^"\n\r']+)["']?/
      );
      if (titleMatch) fileTitle = titleMatch[1];
    }
    const cleanTitle = cleanForPDF(fileTitle).trim();
    doc.text(`- ${cleanTitle.toUpperCase()}`, margin, y);
    y += 6;
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
  }

  // Content Pages
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    if (!fs.existsSync(filePath)) continue;

    const rawContent = fs.readFileSync(filePath, "utf-8");
    const cleanContent = sanitizeContent(rawContent);

    doc.addPage();
    y = 20;

    // Header title
    let fileTitle = file.split("/").pop() || "";
    const frontmatter = rawContent.match(/^---([\s\S]*?)---/);
    if (frontmatter) {
      const titleMatch = frontmatter[1].match(
        /title:\s*["']?([^"\n\r']+)["']?/
      );
      if (titleMatch) fileTitle = titleMatch[1];
    }
    const cleanTitle = cleanForPDF(fileTitle).trim();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text(`[ SECTION: ${cleanTitle.toUpperCase()} ]`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Parse lines
    const lines = cleanContent.split("\n");

    let inCodeBlock = false;
    let inMermaid = false;

    for (let line of lines) {
      line = line.trimEnd();

      // Check code block / Mermaid blocks
      if (line.startsWith("```")) {
        if (line.startsWith("```mermaid")) {
          inMermaid = true;
          continue;
        }
        if (inMermaid) {
          inMermaid = false;
          continue;
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Completely skip rendering Mermaid blocks inside PDF
      if (inMermaid) {
        continue;
      }

      let currentFontType: string;
      let currentFontSize: number;

      if (inCodeBlock) {
        currentFontType = "normal";
        currentFontSize = 9.0; // Slightly smaller to prevent code line wrap
        // Prefix code lines with direct shell symbols
        line = `  ${line}`;
      } else {
        currentFontType = "normal";
        currentFontSize = 10.5;
      }

      // Check headings
      let isHeading = false;
      if (line.startsWith("#")) {
        isHeading = true;
        const level = (line.match(/^#+/) || ["#"])[0].length;
        line = line.replace(/^#+\s*/, "").toUpperCase();
        currentFontType = "bold";
        currentFontSize = level === 1 ? 16 : level === 2 ? 14 : 12;
      }

      // Clean the line text of non-ASCII and emojis before passing to splitTextToSize
      const cleanedLine = cleanForPDF(line);

      const fontFace = inCodeBlock ? "courier" : "helvetica";
      doc.setFont(fontFace, currentFontType);
      doc.setFontSize(currentFontSize);

      // Split text to fit width
      const wrappedLines = doc.splitTextToSize(cleanedLine, contentWidth);
      for (const wrappedLine of wrappedLines) {
        doc.text(wrappedLine, margin, y);
        y += isHeading ? 7 : inCodeBlock ? 5 : 5.5;

        // Page break
        if (y > 275) {
          doc.addPage();
          y = 20;

          // Header on new page
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text(`HOOX SPEC  |  ${cleanTitle.toUpperCase()}`, margin, y - 10);

          // Re-apply style and size
          doc.setFont(fontFace, currentFontType);
          doc.setFontSize(currentFontSize);
        }
      }
    }
  }

  // Save the generated PDF
  doc.save(outputPath);
  console.log(`Generated PDF: ${path.basename(outputPath)}`);
}

// ── 1. Generate PDFs ──
generatePDF(
  "End-User Workspace & Client Operations Manual",
  enduserFiles,
  path.join(publicDir, "Enduser-Full-Documentation.pdf")
);

generatePDF(
  "DevOps Infrastructure, Bindings & System Runbooks",
  devopsFiles,
  path.join(publicDir, "DevOps-Full-Documentation.pdf")
);

// ── 2. Generate Consolidated & Minified llm.txt File ──
let llmText = `HOOX TRADING PLATFORM CONSOLIDATED SYSTEM INTELLIGENCE SPEC\n`;

function appendToLlmText(files: string[]) {
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    llmText += `\nFILE: docs/${file}\n`;
    llmText += minifyLlmText(content);
    llmText += `\n`;
  }
}

appendToLlmText(enduserFiles);
appendToLlmText(devopsFiles);

fs.writeFileSync(path.join(publicDir, "llm.txt"), llmText.trim(), "utf-8");
console.log("Generated minified: llm.txt");
