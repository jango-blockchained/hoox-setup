import ansis from "ansis";

interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  color?: (val: string) => string;
}

interface TableOptions {
  columns: TableColumn[];
  rows: Record<string, any>[];
  title?: string;
  border?: boolean;
}

/**
 * Renders a formatted table to stdout for non-TUI contexts.
 * Uses box-drawing characters for a premium look.
 */
export function printTable({ columns, rows, title, border = true }: TableOptions): void {
  const d = ansis.dim;
  const b = ansis.bold;

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerLen = col.label.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return col.width || Math.max(headerLen, maxDataLen) + 2;
  });

  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + columns.length + 1;

  const horizontalLine = (left: string, mid: string, right: string) => {
    return d(left + widths.map((w) => "─".repeat(w)).join(mid) + right);
  };

  const padCell = (text: string, width: number, align: "left" | "right" | "center" = "left") => {
    const clean = text.replace(/\x1b\[[0-9;]*m/g, ""); // Strip ANSI for width calc
    const pad = Math.max(0, width - clean.length);
    if (align === "right") return " ".repeat(pad) + text;
    if (align === "center") {
      const left = Math.floor(pad / 2);
      return " ".repeat(left) + text + " ".repeat(pad - left);
    }
    return text + " ".repeat(pad);
  };

  // Title
  if (title) {
    console.log("");
    console.log(b(`  ${title}`));
  }

  // Top border
  if (border) console.log("  " + horizontalLine("╭", "┬", "╮"));

  // Header
  const headerCells = columns.map((col, i) =>
    padCell(b(col.label), widths[i], col.align)
  );
  console.log("  " + d("│") + headerCells.join(d("│")) + d("│"));

  // Separator
  if (border) console.log("  " + horizontalLine("├", "┼", "┤"));

  // Rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      let val = String(row[col.key] ?? "");
      if (col.color) val = col.color(val);
      return padCell(val, widths[i], col.align);
    });
    console.log("  " + d("│") + cells.join(d("│")) + d("│"));
  }

  // Bottom border
  if (border) console.log("  " + horizontalLine("╰", "┴", "╯"));
  console.log("");
}

/**
 * Simple key-value display for status-like output.
 */
export function printKeyValue(pairs: Array<[string, string, string?]>): void {
  const d = ansis.dim;
  const maxKey = Math.max(...pairs.map(([k]) => k.length));
  
  for (const [key, value, color] of pairs) {
    const padding = " ".repeat(maxKey - key.length + 2);
    const colorFn = color === "green" ? ansis.green
      : color === "red" ? ansis.red
      : color === "yellow" ? ansis.yellow
      : color === "cyan" ? ansis.cyan
      : (v: string) => v;
    console.log(`  ${d(key)}${padding}${colorFn(value)}`);
  }
}
