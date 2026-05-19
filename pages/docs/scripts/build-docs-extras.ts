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
  "devops/setup_and_operations.md",
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
  "devops/cli_features.md",
];

// Helper to sanitize markdown content
function sanitizeContent(content: string): string {
  // Remove frontmatter
  return content.replace(/^---[\s\S]*?---/, "").trim();
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
  doc.setFont("courier", "bold");
  doc.setFontSize(24);
  doc.text("HOOX TRADING PLATFORM", margin, 60);
  doc.setFontSize(16);
  doc.text(title.toUpperCase(), margin, 75);
  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, margin, 95);
  doc.text("Classification: Technical Documentation Spec", margin, 102);
  doc.text("Design Style: Monospace Terminal Console layout", margin, 109);

  // Table of Contents
  doc.addPage();
  doc.setFont("courier", "bold");
  doc.setFontSize(16);
  doc.text("TABLE OF CONTENTS", margin, y);
  y += 12;
  doc.setFont("courier", "normal");
  doc.setFontSize(10);

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
    // Clean emojis using unicode-aware regex
    const cleanTitle = fileTitle.replace(/\p{Emoji}/gu, "").trim();
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
    // Clean emojis using unicode-aware regex
    const cleanTitle = fileTitle.replace(/\p{Emoji}/gu, "").trim();

    doc.setFont("courier", "bold");
    doc.setFontSize(12);
    doc.text(`[ SECTION: ${cleanTitle.toUpperCase()} ]`, margin, y);
    y += 10;

    // Parse lines
    const lines = cleanContent.split("\n");
    doc.setFont("courier", "normal");
    doc.setFontSize(9.5);

    let inCodeBlock = false;

    for (let line of lines) {
      line = line.trimEnd();

      // Check code block
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        doc.setFont("courier", "bold");
        // Prefix code lines with direct shell symbols
        line = `  ${line}`;
      } else {
        doc.setFont("courier", "normal");
      }

      // Check headings
      let isHeading = false;
      if (line.startsWith("#")) {
        isHeading = true;
        const level = (line.match(/^#+/) || ["#"])[0].length;
        line = line.replace(/^#+\s*/, "").toUpperCase();
        doc.setFont("courier", "bold");
        doc.setFontSize(level === 1 ? 14 : level === 2 ? 12 : 10.5);
      } else {
        doc.setFontSize(9.5);
      }

      // Split text to fit width
      const wrappedLines = doc.splitTextToSize(line, contentWidth);
      for (const wrappedLine of wrappedLines) {
        doc.text(wrappedLine, margin, y);
        y += isHeading ? 7 : inCodeBlock ? 5 : 5.5;

        // Page break
        if (y > 275) {
          doc.addPage();
          y = 20;

          // Header on new page
          doc.setFont("courier", "bold");
          doc.setFontSize(8);
          doc.text(`HOOX SPEC  │  ${cleanTitle.toUpperCase()}`, margin, y - 10);
          doc.setFont("courier", inCodeBlock ? "bold" : "normal");
          doc.setFontSize(isHeading ? 11 : 9.5);
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

// ── 2. Generate Consolidated llm.txt File ──
let llmText = `========================================================================
HOOX TRADING PLATFORM CONSOLIDATED SPEC & SYSTEM INTELLIGENCE
Generated: ${new Date().toISOString()}
========================================================================\n\n`;

function appendToLlmText(files: string[]) {
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf-8");
    llmText += `\n\n========================================================================\n`;
    llmText += `FILE PATH: docs/${file}\n`;
    llmText += `========================================================================\n\n`;
    llmText += sanitizeContent(content);
  }
}

appendToLlmText(enduserFiles);
appendToLlmText(devopsFiles);

fs.writeFileSync(path.join(publicDir, "llm.txt"), llmText, "utf-8");
console.log("Generated: llm.txt");
