import { expect } from "vitest";

/** Postgres error codes used in tests. */
export const PG = { UNIQUE_VIOLATION: "23505", CHECK_VIOLATION: "23514" } as const;

/** Drizzle wraps driver errors: the Postgres error is the `cause`. */
export async function expectPgError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ cause: { code } });
}
