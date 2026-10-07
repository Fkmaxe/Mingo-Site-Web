import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { throwOnValidationError } from "../../core/errors";

const HealthDto = z.object({ status: z.literal("ok") }).meta({ id: "Health" });

const getHealth = createRoute({
  method: "get",
  path: "/health",
  tags: ["health"],
  responses: {
    200: { content: { "application/json": { schema: HealthDto } }, description: "L'API répond" },
  },
});

export function createHealthRouter() {
  return new OpenAPIHono({ defaultHook: throwOnValidationError }).openapi(getHealth, (c) =>
    c.json({ status: "ok" as const }, 200),
  );
}
