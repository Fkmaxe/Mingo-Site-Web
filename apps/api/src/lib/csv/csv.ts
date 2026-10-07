/** Spreadsheet apps evaluate cells starting with these characters as formulas. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Neutralize formula injection (CSV injection), but keep plain negative numbers.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  if (/[";\n\r]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

/**
 * CSV for French spreadsheet software: `;` separator, CRLF, UTF-8 with BOM (Excel needs it
 * to read accents).
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
