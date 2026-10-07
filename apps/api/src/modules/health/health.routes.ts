import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { throwOnValidationError } from "../../core/errors";
import type { Db } from "../../db/client";
import { isDatabaseUp } from "./health.service";

const HealthDto = z
  .object({ status: z.enum(["ok", "degraded"]), database: z.enum(["up", "down"]) })
  .meta({ id: "Health" });

const getHealth = createRoute({
  method: "get",
  path: "/health",
  tags: ["health"],
  responses: {
    200: { content: { "application/json": { schema: HealthDto } }, description: "L'API répond" },
    503: {
      content: { "application/json": { schema: HealthDto } },
      description: "La base de données est injoignable",
    },
  },
});

export function createHealthRouter(db: Db) {
  return new OpenAPIHono({ defaultHook: throwOnValidationError }).openapi(getHealth, async (c) =>
    (await isDatabaseUp(db))
      ? c.json({ status: "ok" as const, database: "up" as const }, 200)
      : c.json({ status: "degraded" as const, database: "down" as const }, 503),
  );
}
