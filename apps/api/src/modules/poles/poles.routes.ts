import { PoleDto, PoleMemberDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { listPoleMembers, listPoles } from "./poles.service";

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

const membersRoute = createRoute({
  method: "get",
  path: "/poles/{poleId}/members",
  tags: ["poles"],
  middleware: [requirePermission("members:read")] as const,
  request: { params: z.object({ poleId: z.uuid() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PoleMemberDto) } },
      description: "Membres et responsables du pôle cette année",
    },
    403: errorResponse("Réservé aux membres du BDE"),
    404: errorResponse("Pôle introuvable"),
  },
});

export function createPolesRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listPolesRoute, async (c) => c.json(await listPoles(c.get("ctx")), 200))
    .openapi(membersRoute, async (c) =>
      c.json(await listPoleMembers(c.get("ctx"), c.req.valid("param").poleId), 200),
    );
}
