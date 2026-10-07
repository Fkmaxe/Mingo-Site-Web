import { MemberDirectoryEntryDto } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import { listDirectory } from "./members.service";

const directoryRoute = createRoute({
  method: "get",
  path: "/members",
  tags: ["members"],
  middleware: [requirePermission("members:read")] as const,
  responses: {
    200: {
      content: { "application/json": { schema: z.array(MemberDirectoryEntryDto) } },
      description: "Annuaire des membres de l'année en cours",
    },
    403: errorResponse("Réservé aux membres du BDE"),
  },
});

export function createMembersRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError }).openapi(
    directoryRoute,
    async (c) => c.json(await listDirectory(c.get("ctx")), 200),
  );
}
