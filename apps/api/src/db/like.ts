/** `ILIKE` pattern matching `text` anywhere, its `%`, `_` and `\\` taken literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
