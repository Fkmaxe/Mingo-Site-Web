import {
  AcceptApplicationInput,
  ApplicationDto,
  ApplicationFileQuery,
  ApplicationFormDto,
  ApplicationLinkInput,
  CreateApplicationInput,
  DecideApplicationInput,
  DOCUMENT_FILE_TYPES,
  ListApplicationsQuery,
  MyApplicationDto,
  UpdateApplicationFormInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import type { DocumentStore } from "../../lib/storage";
import {
  accept,
  apply,
  decide,
  getForm,
  getMyApplication,
  handInFile,
  handInLink,
  listApplications,
  readDocument,
  removeDocument,
  updateForm,
  withdraw,
} from "./applications.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
  409: errorResponse("Déjà candidat, déjà membre ou candidature tranchée"),
};
const Params = z.object({ applicationId: z.uuid() });
const KeyParams = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/) });
const Binary = z.string().meta({ format: "binary" });
/** Photos and PDF are shown in the page; other files are downloaded under their name. */
const INLINE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const formRoute = createRoute({
  method: "get",
  path: "/applications/form",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  responses: { 200: json(ApplicationFormDto, "Formulaire de candidature de l'année"), ...errors },
});
const updateFormRoute = createRoute({
  method: "put",
  path: "/applications/form",
  tags: ["applications"],
  // The bureau only: checked in the service.
  middleware: [requirePermission("members:manage")] as const,
  request: body(UpdateApplicationFormInput),
  responses: { 200: json(ApplicationFormDto, "Formulaire enregistré"), ...errors },
});
const fileRoute = createRoute({
  method: "post",
  path: "/me/application/documents/{key}",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: {
    params: KeyParams,
    query: ApplicationFileQuery,
    body: {
      content: Object.fromEntries(DOCUMENT_FILE_TYPES.map((t) => [t, { schema: Binary }])),
      required: true,
      description: "Le fichier lui-même, 10 Mo au plus",
    },
  },
  responses: { 200: json(ApplicationDto, "Document remis"), ...errors },
});
const linkRoute = createRoute({
  method: "put",
  path: "/me/application/documents/{key}/link",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: { params: KeyParams, ...body(ApplicationLinkInput) },
  responses: { 200: json(ApplicationDto, "Lien remis"), ...errors },
});
const removeDocumentRoute = createRoute({
  method: "delete",
  path: "/me/application/documents/{key}",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: { params: KeyParams },
  responses: { 200: json(ApplicationDto, "Document retiré"), ...errors },
});
// The candidate or a reviewer: checked in the service.
const readFileRoute = createRoute({
  method: "get",
  path: "/applications/files/{name}",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: { params: z.object({ name: z.string().max(64) }) },
  responses: {
    200: {
      content: Object.fromEntries(DOCUMENT_FILE_TYPES.map((t) => [t, { schema: Binary }])),
      description: "Document de la candidature",
    },
    ...errors,
  },
});

const applyRoute = createRoute({
  method: "post",
  path: "/applications",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  request: body(CreateApplicationInput),
  responses: { 201: json(ApplicationDto, "Candidature envoyée"), ...errors },
});
const mineRoute = createRoute({
  method: "get",
  path: "/me/application",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  responses: {
    200: json(MyApplicationDto, "Ma candidature de l'année, ou null"),
    ...errors,
  },
});
const withdrawRoute = createRoute({
  method: "delete",
  path: "/me/application",
  tags: ["applications"],
  middleware: [requireAuth] as const,
  responses: { 204: { description: "Candidature retirée" }, ...errors },
});
const listRoute = createRoute({
  method: "get",
  path: "/applications",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { query: ListApplicationsQuery },
  responses: { 200: json(z.array(ApplicationDto), "Candidatures de l'année"), ...errors },
});
const decideRoute = createRoute({
  method: "post",
  path: "/applications/{applicationId}/decide",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { params: Params, ...body(DecideApplicationInput) },
  responses: { 200: json(ApplicationDto, "Statut changé"), ...errors },
});
const acceptRoute = createRoute({
  method: "post",
  path: "/applications/{applicationId}/accept",
  tags: ["applications"],
  middleware: [requirePermission("members:manage")] as const,
  request: { params: Params, ...body(AcceptApplicationInput) },
  responses: { 200: json(ApplicationDto, "Acceptée : adhésion créée"), ...errors },
});

export function createApplicationsRouter(files: DocumentStore) {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(formRoute, async (c) => c.json(await getForm(authedCtx(c.get("ctx"))), 200))
    .openapi(updateFormRoute, async (c) =>
      c.json(await updateForm(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    )
    .openapi(fileRoute, async (c) =>
      c.json(
        await handInFile(authedCtx(c.get("ctx")), files, c.req.valid("param").key, {
          name: c.req.valid("query").name,
          declaredType: (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "",
          bytes: new Uint8Array(await c.req.arrayBuffer()),
        }),
        200,
      ),
    )
    .openapi(linkRoute, async (c) =>
      c.json(
        await handInLink(
          authedCtx(c.get("ctx")),
          files,
          c.req.valid("param").key,
          c.req.valid("json").url,
        ),
        200,
      ),
    )
    .openapi(removeDocumentRoute, async (c) =>
      c.json(await removeDocument(authedCtx(c.get("ctx")), files, c.req.valid("param").key), 200),
    )
    .openapi(readFileRoute, async (c) => {
      const file = await readDocument(authedCtx(c.get("ctx")), files, c.req.valid("param").name);
      const disposition = INLINE_TYPES.includes(file.type)
        ? "inline"
        : `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;
      return new Response(file.bytes, {
        headers: {
          "content-type": file.type,
          "content-disposition": disposition,
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    })
    .openapi(applyRoute, async (c) =>
      c.json(await apply(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(mineRoute, async (c) => c.json(await getMyApplication(authedCtx(c.get("ctx"))), 200))
    .openapi(withdrawRoute, async (c) => {
      await withdraw(authedCtx(c.get("ctx")), files);
      return c.body(null, 204);
    })
    .openapi(listRoute, async (c) =>
      c.json(await listApplications(authedCtx(c.get("ctx")), c.req.valid("query").status), 200),
    )
    .openapi(decideRoute, async (c) =>
      c.json(
        await decide(
          authedCtx(c.get("ctx")),
          c.req.valid("param").applicationId,
          c.req.valid("json").status,
        ),
        200,
      ),
    )
    .openapi(acceptRoute, async (c) =>
      c.json(
        await accept(
          authedCtx(c.get("ctx")),
          c.req.valid("param").applicationId,
          c.req.valid("json").poleId,
        ),
        200,
      ),
    );
}
