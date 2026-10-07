import { ApiErrorBody } from "@bde/shared";
import { z } from "@hono/zod-openapi";
import { AppError } from "./errors";

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Reusable OpenAPI response entry for error statuses. */
export function errorResponse(description: string) {
  return { content: { "application/json": { schema: ApiErrorBody } }, description };
}

/** Opaque cursor: base64url JSON of the sort key of the last item. */
export function encodeCursor(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends z.ZodType>(cursor: string, schema: T): z.infer<T> {
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch {
    throw new AppError("VALIDATION_ERROR", 400, "Le curseur de pagination est invalide.");
  }
}

/** Splits `limit + 1` fetched rows into a page and the cursor of the next one. */
export function toPage<Row, Item>(
  rows: Row[],
  limit: number,
  toItem: (row: Row) => Item,
  cursorOf: (row: Row) => Record<string, string>,
): Page<Item> {
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toItem),
    nextCursor: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
}

/**
 * Postgres timestamptz rendered as text (`col::text`), e.g. "2026-10-07 14:32:11.123456+00".
 * Keyset cursors on `created_at` keep this exact value: JS dates stop at milliseconds.
 */
export const PgTimestampText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/);
