#!/usr/bin/env bun
/**
 * Migration script: Astro Markdown → Mintlify MDX
 *
 * 1. Converts callout syntax (> **Tip:** → <Tip>)
 * 2. Strips .md extension from internal links
 * 3. Renames .md → .mdx
 */

import { readFile, writeFile, rename, readdir } from "fs/promises";
import path from "path";

async function findFiles(dir: string, ext: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      const relativePath = path.relative(
        dir,
        path.join(entry.parentPath, entry.name)
      );
      files.push(relativePath);
    }
  }
  return files;
}

const CALLBACKS: Record<string, { pattern: RegExp; component: string }> = {
  Tip: { pattern: /^> \*\*Tip:\*\* (.+)$/gm, component: "Tip" },
  Warning: { pattern: /^> \*\*Warning:\*\* (.+)$/gm, component: "Warning" },
  Note: { pattern: /^> \*\*Note:\*\* (.+)$/gm, component: "Note" },
  Welcome: { pattern: /^> \*\*Welcome[^*]+\*\* (.+)$/gm, component: "Tip" },
};

async function main() {
  const docsDir = path.resolve(import.meta.dir, "../docs");

  // Find all .md AND .mdx files (renamed hub pages need link updates too)
  const mdFiles = await findFiles(docsDir, ".md");
  const mdxFiles = await findFiles(docsDir, ".mdx");

  // Process all files for content transformation
  const allFiles = [...mdFiles, ...mdxFiles];
  for (const file of allFiles) {
    const fullPath = path.join(docsDir, file);
    let result = await readFile(fullPath, "utf-8");

    // Step 1: Convert callout syntax
    for (const { pattern, component } of Object.values(CALLBACKS)) {
      result = result.replace(
        pattern,
        (_, text) => `<${component}>${text}</${component}>`
      );
    }

    // Step 2: Update internal links — strip .md extension
    // [text](../path/file.md) → [text](../path/file)
    // [text](../path/file.md#anchor) → [text](../path/file#anchor)
    result = result.replace(
      /(\[[^\]]*\]\([^)]*)\.md(#[^)]*)?\)/g,
      (_, prefix: string, anchor?: string) =>
        anchor ? `${prefix}${anchor})` : `${prefix})`
    );

    await writeFile(fullPath, result, "utf-8");
    console.log(`✓ Processed: ${file}`);
  }

  // Step 3: Rename all .md → .mdx
  for (const mdFile of mdFiles) {
    const mdxFile = mdFile.replace(/\.md$/, ".mdx");
    await rename(path.join(docsDir, mdFile), path.join(docsDir, mdxFile));
    console.log(`✓ Renamed: ${mdFile} → ${mdxFile}`);
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   ${allFiles.length} files processed`);
  console.log(`   ${mdFiles.length} files renamed to .mdx`);
}

main().catch(console.error);
