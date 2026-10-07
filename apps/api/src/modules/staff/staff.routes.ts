import {
  AssignStaffInput,
  CheckinDto,
  CreateStaffSlotInput,
  StaffSlotDto,
  UpdateStaffSlotInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  assign,
  checkInStaff,
  createSlot,
  decide,
  listSlots,
  removeSlot,
  updateSlot,
  volunteer,
  withdraw,
} from "./staff.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const Slots = z.array(StaffSlotDto);
const EventIdParams = z.object({ eventId: z.uuid() });
const SlotIdParams = z.object({ slotId: z.uuid() });
const AssignmentIdParams = z.object({ assignmentId: z.uuid() });
const errors = {
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
  409: errorResponse("Conflit (créneau complet, déjà positionné…)"),
};

const listRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/staff-slots",
  tags: ["staff"],
  middleware: [requireAuth] as const,
  request: { params: EventIdParams },
  responses: { 200: json(Slots, "Créneaux staff (vide pour un étudiant)"), ...errors },
});

const createSlotRoute = createRoute({
  method: "post",
  path: "/events/{eventId}/staff-slots",
  tags: ["staff"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: EventIdParams, ...body(CreateStaffSlotInput) },
  responses: {
    201: json(Slots, "Créneau créé"),
    400: errorResponse("Données invalides"),
    ...errors,
  },
});

const updateSlotRoute = createRoute({
  method: "patch",
  path: "/staff-slots/{slotId}",
  tags: ["staff"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: SlotIdParams, ...body(UpdateStaffSlotInput) },
  responses: {
    200: json(Slots, "Créneau modifié"),
    400: errorResponse("Données invalides"),
    ...errors,
  },
});

const deleteSlotRoute = createRoute({
  method: "delete",
  path: "/staff-slots/{slotId}",
  tags: ["staff"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: SlotIdParams },
  responses: { 204: { description: "Créneau supprimé" }, ...errors },
});

const memberAction = (action: "volunteer" | "withdraw", description: string) =>
  createRoute({
    method: "post",
    path: `/staff-slots/{slotId}/${action}`,
    tags: ["staff"],
    middleware: [requirePermission("staff:register")] as const,
    request: { params: SlotIdParams },
    responses: { 200: json(Slots, description), 422: errorResponse("Pas membre"), ...errors },
  });

const assignRoute = createRoute({
  method: "post",
  path: "/staff-slots/{slotId}/assign",
  tags: ["staff"],
  middleware: [requirePermission("events:update")] as const,
  request: { params: SlotIdParams, ...body(AssignStaffInput) },
  responses: {
    200: json(Slots, "Membre affecté (validé)"),
    422: errorResponse("Pas membre"),
    ...errors,
  },
});

const decideRoute = (action: "validate" | "decline", description: string) =>
  createRoute({
    method: "post",
    path: `/staff-assignments/{assignmentId}/${action}`,
    tags: ["staff"],
    middleware: [requirePermission("events:update")] as const,
    request: { params: AssignmentIdParams },
    responses: { 200: json(Slots, description), ...errors },
  });

const checkinRoute = createRoute({
  method: "post",
  path: "/staff-assignments/{assignmentId}/checkin",
  tags: ["staff"],
  middleware: [requirePermission("checkin:scan")] as const,
  request: { params: AssignmentIdParams },
  responses: { 201: json(CheckinDto, "Présence staff enregistrée"), ...errors },
});

export function createStaffRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) =>
      c.json(await listSlots(c.get("ctx"), c.req.valid("param").eventId), 200),
    )
    .openapi(createSlotRoute, async (c) =>
      c.json(
        await createSlot(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("json"),
        ),
        201,
      ),
    )
    .openapi(updateSlotRoute, async (c) =>
      c.json(
        await updateSlot(authedCtx(c.get("ctx")), c.req.valid("param").slotId, c.req.valid("json")),
        200,
      ),
    )
    .openapi(deleteSlotRoute, async (c) => {
      await removeSlot(authedCtx(c.get("ctx")), c.req.valid("param").slotId);
      return c.body(null, 204);
    })
    .openapi(memberAction("volunteer", "Proposition enregistrée"), async (c) =>
      c.json(await volunteer(authedCtx(c.get("ctx")), c.req.valid("param").slotId), 200),
    )
    .openapi(memberAction("withdraw", "Proposition retirée"), async (c) =>
      c.json(await withdraw(authedCtx(c.get("ctx")), c.req.valid("param").slotId), 200),
    )
    .openapi(assignRoute, async (c) =>
      c.json(
        await assign(
          authedCtx(c.get("ctx")),
          c.req.valid("param").slotId,
          c.req.valid("json").userId,
        ),
        200,
      ),
    )
    .openapi(decideRoute("validate", "Proposition validée"), async (c) =>
      c.json(
        await decide(authedCtx(c.get("ctx")), c.req.valid("param").assignmentId, "validated"),
        200,
      ),
    )
    .openapi(decideRoute("decline", "Proposition refusée"), async (c) =>
      c.json(
        await decide(authedCtx(c.get("ctx")), c.req.valid("param").assignmentId, "declined"),
        200,
      ),
    )
    .openapi(checkinRoute, async (c) =>
      c.json(await checkInStaff(authedCtx(c.get("ctx")), c.req.valid("param").assignmentId), 201),
    );
}
