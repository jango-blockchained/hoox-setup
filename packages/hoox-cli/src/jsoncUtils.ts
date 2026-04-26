/**
 * JSONC (JSON with Comments) utility functions
 */

export function parseJsonc(content: string): unknown {
  // Remove single-line comments
  let jsonContent = content.replace(/\/\/.*$/gm, "");

  // Remove multi-line comments
  jsonContent = jsonContent.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove trailing commas before } or ]
  jsonContent = jsonContent.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(jsonContent);
}

export function stringifyJsonc(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent);
}

/**
 * Extracts comments from JSONC content for preservation
 */
export function extractComments(content: string): {
  header?: string;
  inline: string[];
} {
  const headerMatch = content.match(/^(\s*\/\*[\s\S]*?\*\/\s*)/);
  const header = headerMatch ? headerMatch[1] : undefined;

  const inline: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/\s*\/\/(.*)$/);
    if (match) {
      inline.push(match[1] ?? "");
    }
  }

  return { header, inline };
}

/**
 * Checks if a string is valid JSONC (parseable)
 */
export function isValidJsonc(content: string): boolean {
  try {
    parseJsonc(content);
    return true;
  } catch {
    return false;
  }
}
