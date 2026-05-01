import { parse, printParseErrorCode } from "jsonc-parser";

/**
 * JSONC (JSON with Comments) utility functions
 */

export function parseJsonc(content: string): unknown {
  const errors = [] as { error: number; offset: number; length: number }[];
  const parsed = parse(content, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(
      `Invalid JSONC: ${printParseErrorCode(first.error)} at offset ${first.offset}`
    );
  }

  return parsed;
}

export function stringifyJsonc(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent);
}

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

export function isValidJsonc(content: string): boolean {
  try {
    parseJsonc(content);
    return true;
  } catch {
    return false;
  }
}
