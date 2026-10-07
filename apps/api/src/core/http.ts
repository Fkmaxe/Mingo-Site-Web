import { ApiErrorBody } from "@bde/shared";
import { z } from "@hono/zod-openapi";

export const CursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

/** Reusable OpenAPI response entry for error statuses. */
export function errorResponse(description: string) {
  return { content: { "application/json": { schema: ApiErrorBody } }, description };
}
