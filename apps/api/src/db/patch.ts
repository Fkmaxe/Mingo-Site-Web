/** A partial update where absent fields may be `undefined` (as produced by Zod `.partial()`). */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/**
 * Drops `undefined` fields so they are left untouched by an UPDATE. Returns null when nothing
 * is left: callers skip the UPDATE (an empty SET is invalid SQL).
 */
export function compact<T extends object>(patch: Patch<T>): Partial<T> | null {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : null;
}
