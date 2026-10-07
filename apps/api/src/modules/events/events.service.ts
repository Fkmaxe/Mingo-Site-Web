import {
  type CreateEventData,
  EVENT_VISIBILITIES,
  type EventDto,
  type EventVisibility,
  eventDateIssues,
  type ListEventsQuery,
  type UpdateEventData,
} from "@bde/shared";
import { z } from "zod";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { decodeCursor, type Page, toPage } from "../../core/http";
import { assertPoleAccess } from "../../core/permissions";
import { inTransaction } from "../../core/tx";
import { getPole } from "../poles";
import {
  type EventRow,
  type EventVisibilityFilter,
  findEventByRef,
  findEvents,
  insertEvent,
  slugExists,
  updateEvent as updateEventRow,
} from "./events.repo";
import { slugify, uniqueSlug } from "./slug";

const UUID = z.uuid();
const EventCursor = z.object({ s: z.iso.datetime(), id: z.uuid() });

type AuthzCtx = Pick<Ctx, "user" | "roles" | "permissions" | "memberships">;

function visibleVisibilities(ctx: AuthzCtx): EventVisibility[] {
  if (!ctx.user) return ["public"];
  if (ctx.roles.includes("member")) return [...EVENT_VISIBILITIES];
  return ["public", "students"];
}

/** Poles whose events the user may manage: every pole, some poles, or none. */
function manageablePoles(ctx: AuthzCtx): "all" | string[] {
  if (!ctx.permissions.has("events:update")) return [];
  if (ctx.permissions.has("poles:all")) return "all";
  return ctx.memberships.flatMap((m) => (m.role === "pole_lead" && m.poleId ? [m.poleId] : []));
}

function canManage(ctx: AuthzCtx, poleId: string): boolean {
  const poles = manageablePoles(ctx);
  return poles === "all" || poles.includes(poleId);
}

function isVisible(ctx: AuthzCtx, row: EventRow): boolean {
  if (row.status === "draft") return canManage(ctx, row.poleId);
  return visibleVisibilities(ctx).includes(row.visibility);
}

function visibilityFilter(ctx: AuthzCtx): EventVisibilityFilter {
  return { visibilities: visibleVisibilities(ctx), draftPoles: manageablePoles(ctx) };
}

function toDto(ctx: AuthzCtx, row: EventRow): EventDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    visibility: row.visibility,
    status: row.status,
    capacity: row.capacity,
    registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
    openPointsValue: row.openPointsValue,
    posterUrl: row.posterUrl,
    pole: row.pole,
    canManage: canManage(ctx, row.poleId),
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "Cet événement n'existe pas.");

export async function listEvents(
  ctx: Ctx,
  query: ListEventsQuery,
  now: Date = new Date(),
): Promise<Page<EventDto>> {
  const after = query.cursor ? decodeCursor(query.cursor, EventCursor) : null;
  const rows = await findEvents(ctx.db, {
    filter: visibilityFilter(ctx),
    manageablePoles: query.manageable ? manageablePoles(ctx) : null,
    scope: query.scope,
    poleId: query.poleId,
    now,
    after: after ? { startsAt: new Date(after.s), id: after.id } : null,
    limit: query.limit,
  });
  return toPage(
    rows,
    query.limit,
    (row) => toDto(ctx, row),
    (row) => ({ s: row.startsAt.toISOString(), id: row.id }),
  );
}

/** Finds a visible event by id or slug (404 otherwise, so hidden events are not revealed). */
async function findVisible(ctx: Ctx, ref: string): Promise<EventRow> {
  const row = await findEventByRef(
    ctx.db,
    UUID.safeParse(ref).success ? { id: ref } : { slug: ref },
  );
  if (!row || !isVisible(ctx, row)) throw notFound();
  return row;
}

export async function getEvent(ctx: Ctx, ref: string): Promise<EventDto> {
  return toDto(ctx, await findVisible(ctx, ref));
}

/** Loads an event the user must manage: 404 if invisible, 403 if visible but not theirs. */
async function findManageable(ctx: AuthedCtx, eventId: string): Promise<EventRow> {
  const row = await findVisible(ctx, eventId);
  assertPoleAccess(ctx, row.poleId);
  return row;
}

export async function createEvent(ctx: AuthedCtx, input: CreateEventData): Promise<EventDto> {
  assertPoleAccess(ctx, input.poleId);
  await getPole(ctx, input.poleId);
  const eventId = await inTransaction(ctx.db, async (tx) => {
    const slug = await uniqueSlug(slugify(input.title), (s) => slugExists(tx, s));
    const id = await insertEvent(tx, {
      ...input,
      slug,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      registrationDeadline: input.registrationDeadline
        ? new Date(input.registrationDeadline)
        : null,
      createdBy: ctx.user.id,
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "event.created",
      entity: "event",
      entityId: id,
      payload: { title: input.title, poleId: input.poleId },
    });
    return id;
  });
  return getEvent(ctx, eventId);
}

export async function updateEvent(
  ctx: AuthedCtx,
  eventId: string,
  input: UpdateEventData,
): Promise<EventDto> {
  const existing = await findManageable(ctx, eventId);
  if (existing.status === "cancelled" || existing.status === "done") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Un événement annulé ou terminé ne peut plus être modifié.",
    );
  }
  if (input.poleId && input.poleId !== existing.poleId) {
    assertPoleAccess(ctx, input.poleId);
    await getPole(ctx, input.poleId);
  }
  const issues = eventDateIssues({
    startsAt: input.startsAt ?? existing.startsAt.toISOString(),
    endsAt: input.endsAt ?? existing.endsAt.toISOString(),
    registrationDeadline:
      input.registrationDeadline === undefined
        ? existing.registrationDeadline?.toISOString()
        : input.registrationDeadline,
  });
  const [firstIssue] = issues;
  if (firstIssue) {
    throw new AppError("VALIDATION_ERROR", 400, firstIssue.message, {
      issues: issues.map((i) => ({ path: [i.path], message: i.message })),
    });
  }

  const { startsAt, endsAt, registrationDeadline, ...rest } = input;
  await inTransaction(ctx.db, async (tx) => {
    await updateEventRow(tx, existing.id, {
      ...rest,
      ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
      ...(registrationDeadline !== undefined
        ? { registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null }
        : {}),
    });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "event.updated",
      entity: "event",
      entityId: existing.id,
      payload: { fields: Object.keys(input) },
    });
  });
  return getEvent(ctx, existing.id);
}

async function transition(
  ctx: AuthedCtx,
  eventId: string,
  change: {
    from: EventRow["status"][];
    to: "published" | "cancelled";
    action: string;
    refusal: string;
  },
): Promise<EventDto> {
  const existing = await findManageable(ctx, eventId);
  if (!change.from.includes(existing.status)) {
    throw new AppError("INVALID_STATUS_TRANSITION", 409, change.refusal);
  }
  await inTransaction(ctx.db, async (tx) => {
    await updateEventRow(tx, existing.id, { status: change.to });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: change.action,
      entity: "event",
      entityId: existing.id,
      payload: { from: existing.status },
    });
  });
  return getEvent(ctx, existing.id);
}

export function publishEvent(ctx: AuthedCtx, eventId: string) {
  return transition(ctx, eventId, {
    from: ["draft"],
    to: "published",
    action: "event.published",
    refusal: "Seul un brouillon peut être publié.",
  });
}

export function cancelEvent(ctx: AuthedCtx, eventId: string) {
  return transition(ctx, eventId, {
    from: ["draft", "published"],
    to: "cancelled",
    action: "event.cancelled",
    refusal: "Cet événement est déjà annulé ou terminé.",
  });
}

export async function deleteEvent(ctx: AuthedCtx, eventId: string): Promise<void> {
  const existing = await findManageable(ctx, eventId);
  if (existing.status !== "draft") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Seul un brouillon peut être supprimé. Annule plutôt l'événement.",
    );
  }
  await inTransaction(ctx.db, async (tx) => {
    await updateEventRow(tx, existing.id, { deletedAt: new Date() });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "event.deleted",
      entity: "event",
      entityId: existing.id,
      payload: { title: existing.title },
    });
  });
}
