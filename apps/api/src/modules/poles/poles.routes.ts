import { PoleDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { listPoles } from "./poles.service";

const listPolesRoute = createRoute({
  method: "get",
  path: "/poles",
  tags: ["poles"],
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PoleDto) } },
      description: "Pôles du BDE",
    },
  },
});

export function createPolesRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError }).openapi(
    listPolesRoute,
    async (c) => c.json(await listPoles(c.get("ctx")), 200),
  );
}
