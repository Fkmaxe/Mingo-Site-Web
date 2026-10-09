/**
 * Anti-invention: a value nobody has confirmed is typed `Pending`. It shows as « À préciser »
 * on the page, but the structured-data builders only accept confirmed values: passing a
 * pending field to Google does not compile.
 */
export type Pending = { readonly kind: "pending"; readonly reason: string };

export type Fact<T> = T | Pending;

export const pending = (reason: string): Pending => ({ kind: "pending", reason });

export function isPending<T>(value: Fact<T>): value is Pending {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "pending";
}

/** The value when confirmed, `undefined` otherwise. */
export function confirmed<T>(value: Fact<T>): T | undefined {
  return isPending(value) ? undefined : value;
}
