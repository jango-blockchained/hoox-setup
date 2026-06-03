/**
 * build-docs-extras.ts — PDF & LLM Text Generator for Hoox Documentation
 *
 * Generates:
 * 1. DevOps-Full-Documentation.pdf — Professional branded PDF
 * 2. Enduser-Full-Documentation.pdf — Professional branded PDF
 * 3. llm.txt — Consolidated, minified text for LLM consumption
 *
 * Pipeline: Markdown → markdown-it + shiki → HTML → Puppeteer → PDF
 *
 * Graceful fallback: If Puppeteer/Chromium is unavailable, PDF generation
 * is skipped but llm.txt is still produced.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  processFiles,
  stripFrontmatter,
  extractTitle,
} from "./markdown-processor.ts";
import { buildHtmlDocument } from "./pdf-template.ts";
import { generatePdfOrSkip, closeBrowser } from "./pdf-generator.ts";

// ── Project Roots ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const docsDir = path.join(repoRoot, "docs");
const publicDir = path.join(repoRoot, "pages/docs/public");

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// ── Document File Lists ────────────────────────────────────────────────────────

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

// ── PDF Generation ──────────────────────────────────────────────────────────────

async function generatePdfs(): Promise<void> {
  console.log("📄 Generating PDFs with Puppeteer...\n");

  // Process enduser docs
  console.log("  Processing enduser documentation...");
  const enduserSections = await processFiles(enduserFiles, docsDir);
  const enduserHtml = buildHtmlDocument({
    title: "End-User Workspace & Client Operations Manual",
    subtitle: "Hoox Trading Platform",
    sections: enduserSections,
    classification: "Technical Documentation",
  });

  // Process devops docs
  console.log("  Processing devops documentation...");
  const devopsSections = await processFiles(devopsFiles, docsDir);
  const devopsHtml = buildHtmlDocument({
    title: "DevOps Infrastructure, Bindings & System Runbooks",
    subtitle: "Hoox Trading Platform",
    sections: devopsSections,
    classification: "Technical Documentation",
  });

  // Generate PDFs (with graceful fallback)
  console.log("  Rendering Enduser PDF...");
  const enduserOk = await generatePdfOrSkip({
    outputPath: path.join(publicDir, "Enduser-Full-Documentation.pdf"),
    html: enduserHtml,
    title: "HOOX — End-User Manual",
  });

  console.log("  Rendering DevOps PDF...");
  const devopsOk = await generatePdfOrSkip({
    outputPath: path.join(publicDir, "DevOps-Full-Documentation.pdf"),
    html: devopsHtml,
    title: "HOOX — DevOps Manual",
  });

  // Close browser when done
  await closeBrowser();

  if (!enduserOk || !devopsOk) {
    console.log(
      "\n⚠️  Some PDFs were skipped (Puppeteer/Chromium not available)."
    );
    console.log("   llm.txt was still generated successfully.\n");
  } else {
    console.log("\n✅ All PDFs generated successfully.\n");
  }
}

// ── LLM Text Generation ────────────────────────────────────────────────────────

/**
 * Generate an improved llm.txt with:
 * - Section markers for each file
 * - Preserved code blocks (with language identifiers)
 * - Emojis kept (unicode-safe)
 * - Mermaid blocks replaced with placeholder text
 * - YAML frontmatter included as metadata headers
 */
function generateLlmText(): void {
  console.log("📝 Generating llm.txt...\n");

  const date = new Date().toISOString().split("T")[0];
  let llmText = `HOOX TRADING PLATFORM — CONSOLIDATED SYSTEM INTELLIGENCE SPEC\n`;
  llmText += `Generated: ${date}\n`;
  llmText += `${"═".repeat(72)}\n\n`;

  function appendSection(sectionTitle: string, files: string[]): void {
    llmText += `${"═".repeat(72)}\n`;
    llmText += `════════ SECTION: ${sectionTitle.toUpperCase()} ════════\n`;
    llmText += `${"═".repeat(72)}\n\n`;

    for (const file of files) {
      const filePath = path.join(docsDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`  Warning: File not found: ${file}`);
        continue;
      }

      const rawContent = fs.readFileSync(filePath, "utf-8");
      const title = extractTitle(rawContent, file);

      // Section header with file path and title
      llmText += `${"─".repeat(72)}\n`;
      llmText += `──── FILE: docs/${file} ────\n`;
      llmText += `──── TITLE: ${title} ────\n`;
      llmText += `${"─".repeat(72)}\n\n`;

      // Include frontmatter as metadata
      const frontmatter = rawContent.match(/^---([\s\S]*?)---/);
      if (frontmatter) {
        llmText += `[METADATA]\n${frontmatter[1].trim()}\n[/METADATA]\n\n`;
      }

      // Process content: strip frontmatter, replace mermaid blocks
      let content = stripFrontmatter(rawContent);

      // Replace mermaid blocks with placeholder
      content = content.replace(
        /```mermaid[\s\S]*?```/g,
        "[Architecture Diagram — See Online Docs at https://docs.hoox.trade]"
      );

      // Preserve code blocks with language identifiers
      // (don't strip backticks — LLMs understand markdown code blocks)

      llmText += content.trim();
      llmText += "\n\n";
    }
  }

  appendSection("End-User Documentation", enduserFiles);
  appendSection("DevOps Documentation", devopsFiles);

  // Write llm.txt
  const outputPath = path.join(publicDir, "llm.txt");
  fs.writeFileSync(outputPath, llmText.trim(), "utf-8");

  const stats = fs.statSync(outputPath);
  console.log(`  Generated: llm.txt (${(stats.size / 1024).toFixed(0)}KB)\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🚀 Building documentation extras...\n");
  console.log(`  Docs dir: ${docsDir}`);
  console.log(`  Output dir: ${publicDir}\n`);

  // Generate llm.txt first (always succeeds, no Puppeteer dependency)
  generateLlmText();

  // Generate PDFs (may skip if Puppeteer unavailable)
  await generatePdfs();

  console.log("✨ Documentation extras build complete.\n");
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
