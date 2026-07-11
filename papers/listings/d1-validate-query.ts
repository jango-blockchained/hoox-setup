// Source: workers/d1-worker/src/index.ts (lines 109-189)
// Listing id: d1-validate-query
// Caption: d1-worker SELECT query guard (allowlist, no literals, no UNION)
function validateQuery(query: string): {
  valid: boolean;
  error?: string;
  statusCode?: number;
} {
  // 0. Strip SQL comments to prevent comment-based bypass of validation
  const cleaned = stripSqlComments(query);
  const normalized = cleaned.trim().toUpperCase();

  // 1. Check query type - only SELECT queries are allowed
  const queryType = normalized.split(/\s+/)[0];
  if (queryType !== "SELECT") {
    return {
      valid: false,
      error: `Unsupported query type: ${queryType}. Only SELECT queries are allowed.`,
      statusCode: 400,
    };
  }

  // 2. Reject string literals - all values must use ? parameter placeholders -> 400
  // Prevents injection via string concatenation like: WHERE id = '1' OR '1'='1'
  const stringLiteralRegex = /'([^']|'')*'/g;
  if (stringLiteralRegex.test(cleaned)) {
    return {
      valid: false,
      error:
        "String literals not allowed in query. Use parameter placeholders (?) instead.",
      statusCode: 400,
    };
  }

  // 3. Reject double-quoted identifiers -> 400
  const doubleQuotedRegex = /"[^"]*"/g;
  if (doubleQuotedRegex.test(cleaned)) {
    return {
      valid: false,
      error: "Quoted identifiers not allowed in query.",
      statusCode: 400,
    };
  }

  // 4. Validate table names against allowlist -> 403
  // Extract table names from FROM, JOIN, INTO, UPDATE clauses
  const tableRegex = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_]+)/gi;
  let match;
  const tablesFound = new Set<string>();

  while ((match = tableRegex.exec(cleaned)) !== null) {
    tablesFound.add(match[1].toLowerCase());
  }

  // If tables are found, they must be in the allowlist
  for (const table of tablesFound) {
    if (!TABLE_ALLOWLIST.includes(table)) {
      return {
        valid: false,
        error: `Unauthorized table access: ${table}`,
        statusCode: 403,
      };
    }
  }

  // 5. Reject UNION (can be used for data exfiltration) -> 403
  if (/\bUNION\b/i.test(cleaned)) {
    return {
      valid: false,
      error: "UNION not allowed in SELECT queries",
      statusCode: 403,
    };
  }

  // 6. Reject subqueries in WHERE/HAVING (complexity/DoS risk) -> 403
  if (/\b(WHERE|HAVING)\s*\(/i.test(cleaned)) {
    return {
      valid: false,
      error: "Subqueries in WHERE/HAVING not allowed",
      statusCode: 403,
    };
  }

  return { valid: true };
