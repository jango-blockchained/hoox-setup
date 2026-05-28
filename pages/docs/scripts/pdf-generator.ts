/**
 * pdf-generator.ts — Puppeteer PDF Generation
 *
 * Renders HTML documents to PDF using Puppeteer with:
 * - Branded headers and footers with page numbers
 * - Mermaid diagram rendering (waits for client-side JS)
 * - Graceful fallback if Puppeteer/Chromium is unavailable
 * - CI/Docker compatibility (--no-sandbox flag)
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import fs from "fs";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfOptions {
  /** Output file path for the PDF */
  outputPath: string;
  /** Complete HTML document string (from pdf-template.ts) */
  html: string;
  /** PDF page format (default: A4) */
  format?: "A4" | "Letter";
  /** Whether to print background colors (default: true) */
  printBackground?: boolean;
  /** Margin in mm (default: 20mm all sides) */
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  /** Whether to display header/footer (default: true) */
  displayHeaderFooter?: boolean;
  /** Title for header/footer */
  title?: string;
}

// ── Browser Management ────────────────────────────────────────────────────────

let _browser: Browser | null = null;

/**
 * Launch or reuse a Puppeteer browser instance.
 * Uses --no-sandbox for CI/Docker compatibility.
 */
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;

  // Use system Chromium if available (PUPPETEER_EXECUTABLE_PATH env var)
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  _browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  return _browser;
}

/**
 * Close the shared browser instance.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// ── PDF Generation ─────────────────────────────────────────────────────────────

/**
 * Generate a PDF from an HTML document string.
 *
 * The HTML is loaded into a Puppeteer page, mermaid diagrams are rendered,
 * and the page is printed to PDF with branded headers and footers.
 *
 * @throws Error if Puppeteer/Chromium is unavailable
 */
export async function generatePdf(options: PdfOptions): Promise<void> {
  const {
    outputPath,
    html,
    format = "A4",
    printBackground = true,
    margin = {
      top: "20mm",
      bottom: "25mm",
      left: "20mm",
      right: "20mm",
    },
    displayHeaderFooter = true,
    title = "HOOX Documentation",
  } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set content and wait for DOM to load
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for mermaid diagrams to render
    await waitForMermaid(page);

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Additional wait for rendering stability
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate PDF
    await page.pdf({
      path: outputPath,
      format,
      printBackground,
      margin,
      displayHeaderFooter,
      headerTemplate: getHeaderTemplate(title),
      footerTemplate: getFooterTemplate(),
    });

    const stats = fs.statSync(outputPath);
    console.log(
      `Generated PDF: ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(0)}KB)`
    );
  } finally {
    await page.close();
  }
}

// ── Mermaid Rendering ──────────────────────────────────────────────────────────

/**
 * Wait for mermaid diagrams to finish rendering.
 * If mermaid is not loaded (no diagrams), resolves immediately.
 */
async function waitForMermaid(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // Check if mermaid is loaded
        if (
          typeof (window as unknown as Record<string, unknown>).mermaid ===
          "undefined"
        ) {
          resolve();
          return;
        }

        // Check if there are any mermaid diagrams
        const mermaidDivs = document.querySelectorAll(".mermaid");
        if (mermaidDivs.length === 0) {
          resolve();
          return;
        }

        // Wait up to 10 seconds for mermaid to render
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 10000);

        // Poll for mermaid rendering completion
        const checkInterval = setInterval(() => {
          const svgs = document.querySelectorAll(".mermaid svg");
          if (svgs.length >= mermaidDivs.length) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve();
            }
          }
        }, 200);
      });
    });
  } catch {
    // Mermaid rendering failed — continue without diagrams
    console.warn("Warning: Mermaid diagram rendering timed out or failed");
  }
}

// ── Header/Footer Templates ────────────────────────────────────────────────────

function getHeaderTemplate(title: string): string {
  return `
    <div style="width: 100%; font-size: 8px; padding: 0 20mm; display: flex; justify-content: space-between; align-items: center; color: #888; font-family: 'IBM Plex Sans Variable', 'IBM Plex Sans', sans-serif;">
      <span style="font-weight: 600; color: #d4a843;">HOOX</span>
      <span style="text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(title)}</span>
    </div>
  `;
}

function getFooterTemplate(): string {
  return `
    <div style="width: 100%; font-size: 8px; padding: 0 20mm; display: flex; justify-content: space-between; align-items: center; color: #888; font-family: 'IBM Plex Mono', monospace;">
      <span>Confidential</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Graceful Fallback ──────────────────────────────────────────────────────────

/**
 * Attempt to generate a PDF, but gracefully skip if Puppeteer/Chromium
 * is unavailable (e.g., in CI environments without Chromium).
 *
 * @returns true if PDF was generated, false if skipped
 */
export async function generatePdfOrSkip(options: PdfOptions): Promise<boolean> {
  try {
    await generatePdf(options);
    return true;
  } catch (err) {
    const message = (err as Error).message || String(err);

    if (
      message.includes("Could not find Chrome") ||
      message.includes("Failed to launch") ||
      message.includes("Chromium") ||
      message.includes("Executable doesn't exist")
    ) {
      console.warn(
        `⚠️  Skipping PDF generation: Puppeteer/Chromium not available.\n` +
          `   ${message}\n` +
          `   Install Chromium with: npx puppeteer browsers install chrome\n` +
          `   Or set PUPPETEER_SKIP_DOWNLOAD=1 and install chromium-browser.`
      );
      return false;
    }

    // Re-throw unexpected errors
    throw err;
  }
}
