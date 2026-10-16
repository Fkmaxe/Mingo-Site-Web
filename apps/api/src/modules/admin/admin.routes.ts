import {
  AdminUserDto,
  AdminUsersDto,
  AdminUsersQuery,
  AuditEntryDto,
  AuditQuery,
  CreateSchoolYearInput,
  PoleDto,
  PoleInput,
  SchoolYearDto,
  SetAdminInput,
  SetMembershipInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, jsonBody, jsonResponse, paginated } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createPole,
  createSchoolYear,
  deleteMembership,
  editPole,
  listAuditEntries,
  listSchoolYears,
  listUsers,
  setAdmin,
  setCurrentSchoolYear,
  setMembership,
} from "./admin.service";

const Id = z.object({ id: z.uuid() });
const common = {
  401: errorResponse("Pas de session"),
  403: errorResponse("Réservé aux administrateurs"),
};

// --- School years (settings:manage) ---

const yearsRoute = createRoute({
  method: "get",
  path: "/admin/school-years",
  tags: ["admin"],
  middleware: [requirePermission("settings:manage")] as const,
  responses: { 200: jsonResponse(z.array(SchoolYearDto), "Années scolaires"), ...common },
});

const createYearRoute = createRoute({
  method: "post",
  path: "/admin/school-years",
  tags: ["admin"],
  middleware: [requirePermission("settings:manage")] as const,
  request: jsonBody(CreateSchoolYearInput),
  responses: {
    201: jsonResponse(z.array(SchoolYearDto), "Année créée (la première devient l'année en cours)"),
    400: errorResponse("Données invalides"),
    409: errorResponse("ALREADY_EXISTS"),
    ...common,
  },
});

const currentYearRoute = createRoute({
  method: "post",
  path: "/admin/school-years/{id}/current",
  tags: ["admin"],
  middleware: [requirePermission("settings:manage")] as const,
  request: { params: Id },
  responses: {
    200: jsonResponse(z.array(SchoolYearDto), "Année en cours changée"),
    404: errorResponse("Année introuvable"),
    ...common,
  },
});

// --- Poles (settings:manage) ---

const createPoleRoute = createRoute({
  method: "post",
  path: "/admin/poles",
  tags: ["admin"],
  middleware: [requirePermission("settings:manage")] as const,
  request: jsonBody(PoleInput),
  responses: {
    201: jsonResponse(PoleDto, "Pôle créé"),
    400: errorResponse("Données invalides"),
    409: errorResponse("ALREADY_EXISTS"),
    ...common,
  },
});

const editPoleRoute = createRoute({
  method: "put",
  path: "/admin/poles/{id}",
  tags: ["admin"],
  middleware: [requirePermission("settings:manage")] as const,
  request: { params: Id, ...jsonBody(PoleInput) },
  responses: {
    200: jsonResponse(PoleDto, "Pôle modifié"),
    400: errorResponse("Données invalides"),
    404: errorResponse("Pôle introuvable"),
    409: errorResponse("ALREADY_EXISTS"),
    ...common,
  },
});

// --- Members and roles (roles:manage) ---

const usersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["admin"],
  middleware: [requirePermission("roles:manage")] as const,
  request: { query: AdminUsersQuery },
  responses: {
    200: jsonResponse(AdminUsersDto, "Comptes (100 au plus) et rôles de l'année"),
    ...common,
  },
});

const setMembershipRoute = createRoute({
  method: "post",
  path: "/admin/memberships",
  tags: ["admin"],
  middleware: [requirePermission("roles:manage")] as const,
  request: jsonBody(SetMembershipInput),
  responses: {
    200: jsonResponse(AdminUserDto, "Rôle donné pour l'année en cours"),
    400: errorResponse("Données invalides"),
    404: errorResponse("Compte ou pôle introuvable"),
    422: errorResponse("NO_CURRENT_SCHOOL_YEAR"),
    ...common,
  },
});

const removeMembershipRoute = createRoute({
  method: "delete",
  path: "/admin/memberships/{id}",
  tags: ["admin"],
  middleware: [requirePermission("roles:manage")] as const,
  request: { params: Id },
  responses: {
    200: jsonResponse(AdminUserDto, "Rôle retiré"),
    404: errorResponse("Rôle introuvable"),
    ...common,
  },
});

const setAdminRoute = createRoute({
  method: "put",
  path: "/admin/users/{id}/admin",
  tags: ["admin"],
  middleware: [requirePermission("roles:manage")] as const,
  request: { params: Id, ...jsonBody(SetAdminInput) },
  responses: {
    200: jsonResponse(AdminUserDto, "Droits d'administrateur changés"),
    404: errorResponse("Compte introuvable"),
    ...common,
  },
});

// --- Audit log (audit:read) ---

const auditRoute = createRoute({
  method: "get",
  path: "/admin/audit",
  tags: ["admin"],
  middleware: [requirePermission("audit:read")] as const,
  request: { query: AuditQuery },
  responses: {
    200: jsonResponse(paginated(AuditEntryDto), "Journal des actions sensibles"),
    ...common,
  },
});

export function createAdminRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(yearsRoute, async (c) => c.json(await listSchoolYears(authedCtx(c.get("ctx"))), 200))
    .openapi(createYearRoute, async (c) =>
      c.json(await createSchoolYear(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(currentYearRoute, async (c) =>
      c.json(await setCurrentSchoolYear(authedCtx(c.get("ctx")), c.req.valid("param").id), 200),
    )
    .openapi(createPoleRoute, async (c) =>
      c.json(await createPole(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(editPoleRoute, async (c) =>
      c.json(
        await editPole(authedCtx(c.get("ctx")), c.req.valid("param").id, c.req.valid("json")),
        200,
      ),
    )
    .openapi(usersRoute, async (c) =>
      c.json(await listUsers(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(setMembershipRoute, async (c) =>
      c.json(await setMembership(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    )
    .openapi(removeMembershipRoute, async (c) =>
      c.json(await deleteMembership(authedCtx(c.get("ctx")), c.req.valid("param").id), 200),
    )
    .openapi(setAdminRoute, async (c) =>
      c.json(
        await setAdmin(
          authedCtx(c.get("ctx")),
          c.req.valid("param").id,
          c.req.valid("json").isAdmin,
        ),
        200,
      ),
    )
    .openapi(auditRoute, async (c) =>
      c.json(await listAuditEntries(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    );
}
