import { CreatePartnerInput, PartnerDto, PublicPartnerDto, UpdatePartnerInput } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, jsonBody, jsonResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createPartner,
  deletePartner,
  getPartner,
  listPartners,
  listPublicPartners,
  updatePartner,
} from "./partners.service";

const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
};
const Params = z.object({ partnerId: z.uuid() });

const publicRoute = createRoute({
  method: "get",
  path: "/partners/public",
  tags: ["partners"],
  responses: { 200: jsonResponse(z.array(PublicPartnerDto), "Partenaires actifs (page publique)") },
});
const listRoute = createRoute({
  method: "get",
  path: "/partners",
  tags: ["partners"],
  middleware: [requirePermission("members:read")] as const,
  responses: { 200: jsonResponse(z.array(PartnerDto), "Fiches partenaires"), ...errors },
});
const getRoute = createRoute({
  method: "get",
  path: "/partners/{partnerId}",
  tags: ["partners"],
  middleware: [requirePermission("members:read")] as const,
  request: { params: Params },
  responses: { 200: jsonResponse(PartnerDto, "Fiche partenaire"), ...errors },
});
const createPartnerRoute = createRoute({
  method: "post",
  path: "/partners",
  tags: ["partners"],
  middleware: [requirePermission("partners:manage")] as const,
  request: jsonBody(CreatePartnerInput),
  responses: { 201: jsonResponse(PartnerDto, "Partenaire créé"), ...errors },
});
// The board or the partner's referent: checked in the service.
const updateRoute = createRoute({
  method: "patch",
  path: "/partners/{partnerId}",
  tags: ["partners"],
  middleware: [requireAuth] as const,
  request: { params: Params, ...jsonBody(UpdatePartnerInput) },
  responses: { 200: jsonResponse(PartnerDto, "Fiche modifiée"), ...errors },
});
const deleteRoute = createRoute({
  method: "delete",
  path: "/partners/{partnerId}",
  tags: ["partners"],
  middleware: [requirePermission("partners:manage")] as const,
  request: { params: Params },
  responses: { 204: { description: "Partenaire supprimé" }, ...errors },
});

export function createPartnersRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(publicRoute, async (c) => c.json(await listPublicPartners(c.get("ctx")), 200))
    .openapi(listRoute, async (c) => c.json(await listPartners(authedCtx(c.get("ctx"))), 200))
    .openapi(getRoute, async (c) =>
      c.json(await getPartner(authedCtx(c.get("ctx")), c.req.valid("param").partnerId), 200),
    )
    .openapi(createPartnerRoute, async (c) =>
      c.json(await createPartner(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(updateRoute, async (c) =>
      c.json(
        await updatePartner(
          authedCtx(c.get("ctx")),
          c.req.valid("param").partnerId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(deleteRoute, async (c) => {
      await deletePartner(authedCtx(c.get("ctx")), c.req.valid("param").partnerId);
      return c.body(null, 204);
    });
}
