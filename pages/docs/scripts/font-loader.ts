/**
 * font-loader.ts — Base64 WOFF2 Font Embedding for PDF Generation
 *
 * Reads WOFF2 font files from @fontsource packages and converts them to
 * base64 data URIs for embedding in PDF HTML templates. This ensures
 * fonts render correctly in Puppeteer-generated PDFs without external
 * network dependencies.
 *
 * Design tokens match pages/docs/src/styles/globals.css:
 *   --font-sans: "IBM Plex Sans Variable"
 *   --font-mono: "IBM Plex Mono"
 *   --font-heading: "Bebas Neue"
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

// ── Font File Paths ──────────────────────────────────────────────────────────
// Bun resolves packages from the monorepo root's node_modules/.bun/ directory.
// We use direct path resolution to find the WOFF2 files.

interface FontFile {
  name: string;
  family: string;
  weight: number;
  style: "normal" | "italic";
  woff2Path: string;
}

const fontFiles: FontFile[] = [
  // IBM Plex Sans Variable (weight axis)
  {
    name: "ibm-plex-sans-latin-wght-normal",
    family: "IBM Plex Sans Variable",
    weight: 400,
    style: "normal",
    woff2Path:
      "node_modules/.bun/@fontsource-variable+ibm-plex-sans@5.2.8/node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
  },
  {
    name: "ibm-plex-sans-latin-wght-italic",
    family: "IBM Plex Sans Variable",
    weight: 400,
    style: "italic",
    woff2Path:
      "node_modules/.bun/@fontsource-variable+ibm-plex-sans@5.2.8/node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2",
  },
  // IBM Plex Mono (static weights for code)
  {
    name: "ibm-plex-mono-latin-400-normal",
    family: "IBM Plex Mono",
    weight: 400,
    style: "normal",
    woff2Path:
      "node_modules/.bun/@fontsource+ibm-plex-mono@5.2.7/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  },
  {
    name: "ibm-plex-mono-latin-400-italic",
    family: "IBM Plex Mono",
    weight: 400,
    style: "italic",
    woff2Path:
      "node_modules/.bun/@fontsource+ibm-plex-mono@5.2.7/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-italic.woff2",
  },
  {
    name: "ibm-plex-mono-latin-600-normal",
    family: "IBM Plex Mono",
    weight: 600,
    style: "normal",
    woff2Path:
      "node_modules/.bun/@fontsource+ibm-plex-mono@5.2.7/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2",
  },
  {
    name: "ibm-plex-mono-latin-700-normal",
    family: "IBM Plex Mono",
    weight: 700,
    style: "normal",
    woff2Path:
      "node_modules/.bun/@fontsource+ibm-plex-mono@5.2.7/node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2",
  },
  // Bebas Neue (display heading font)
  {
    name: "bebas-neue-latin-400-normal",
    family: "Bebas Neue",
    weight: 400,
    style: "normal",
    woff2Path:
      "node_modules/.bun/@fontsource+bebas-neue@5.2.7/node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2",
  },
];

// ── Font Loading ─────────────────────────────────────────────────────────────

/**
 * Load a WOFF2 font file and return its base64 data URI.
 * Falls back to searching common paths if the primary path doesn't exist.
 */
function loadFontAsBase64(woff2Path: string): string {
  const fullPath = path.resolve(repoRoot, woff2Path);

  if (fs.existsSync(fullPath)) {
    const buffer = fs.readFileSync(fullPath);
    return `data:font/woff2;base64,${buffer.toString("base64")}`;
  }

  // Fallback: search for the font file by name in node_modules
  const fileName = path.basename(woff2Path);
  const searchDirs = [
    path.resolve(repoRoot, "node_modules"),
    path.resolve(repoRoot, "node_modules/.bun"),
  ];

  for (const searchDir of searchDirs) {
    if (!fs.existsSync(searchDir)) continue;

    // Walk up to 3 levels deep looking for the font file
    const found = findFileRecursive(searchDir, fileName, 4);
    if (found) {
      const buffer = fs.readFileSync(found);
      return `data:font/woff2;base64,${buffer.toString("base64")}`;
    }
  }

  throw new Error(
    `Font file not found: ${fileName}. Searched:\n  ${fullPath}\n  ${searchDirs.join("\n  ")}`
  );
}

/**
 * Recursively search for a file by name up to maxDepth levels.
 */
function findFileRecursive(
  dir: string,
  fileName: string,
  maxDepth: number
): string | null {
  if (maxDepth <= 0) return null;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === fileName) {
        return path.join(dir, entry.name);
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const found = findFileRecursive(
          path.join(dir, entry.name),
          fileName,
          maxDepth - 1
        );
        if (found) return found;
      }
    }
  } catch {
    // Permission denied or other FS errors — skip
  }

  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface FontFace {
  family: string;
  weight: number;
  style: "normal" | "italic";
  src: string; // base64 data URI
}

/**
 * Load all fonts and return @font-face declarations as a CSS string.
 * This CSS can be embedded directly in the PDF HTML template.
 */
export function loadFontsAsCss(): string {
  const declarations: string[] = [];

  for (const font of fontFiles) {
    try {
      const src = loadFontAsBase64(font.woff2Path);
      const weightRange =
        font.family === "IBM Plex Sans Variable"
          ? "100 900"
          : String(font.weight);

      declarations.push(`
@font-face {
  font-family: "${font.family}";
  font-style: ${font.style};
  font-weight: ${weightRange};
  font-display: swap;
  src: url("${src}") format("woff2");
}`);
    } catch (err) {
      console.warn(
        `Warning: Could not load font ${font.name}: ${(err as Error).message}`
      );
    }
  }

  return declarations.join("\n");
}

/**
 * Load all fonts and return structured FontFace objects.
 * Useful for programmatic font registration.
 */
export function loadFonts(): FontFace[] {
  const fonts: FontFace[] = [];

  for (const font of fontFiles) {
    try {
      const src = loadFontAsBase64(font.woff2Path);
      fonts.push({
        family: font.family,
        weight: font.weight,
        style: font.style,
        src,
      });
    } catch (err) {
      console.warn(
        `Warning: Could not load font ${font.name}: ${(err as Error).message}`
      );
    }
  }

  return fonts;
}
