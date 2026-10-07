/** A partial update where absent fields may be `undefined` (as produced by Zod `.partial()`). */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/** Drops `undefined` fields so they are left untouched by an UPDATE. */
export function compact<T extends object>(patch: Patch<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
