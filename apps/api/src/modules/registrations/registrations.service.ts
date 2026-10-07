import type { RegistrantDto, RegistrationStatus, TicketDto } from "@bde/shared";
import { z } from "zod";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { decodeCursor, type Page, toPage } from "../../core/http";
import { inTransaction } from "../../core/tx";
import { findManageableEvent, findVisibleEvent } from "../events";
import {
  countConfirmed,
  findParticipant,
  findParticipantByToken,
  findRegistrants,
  findRegistration,
  findTicket,
  findUserTickets,
  insertRegistration,
  lockEventRegistrations,
  searchConfirmedParticipants,
  type TicketRow,
  updateRegistration,
} from "./registrations.repo";
import { canUnregister, newQrToken, registrationState } from "./rules";

function toTicket(row: TicketRow): TicketDto {
  return {
    id: row.id,
    status: row.status,
    qrToken: row.qrToken,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    event: {
      ...row.event,
      startsAt: row.event.startsAt.toISOString(),
      endsAt: row.event.endsAt.toISOString(),
    },
  };
}

const ticketNotFound = () => new AppError("NOT_FOUND", 404, "Ce billet n'existe pas.");

/** Own ticket only: someone else's registration is reported as missing. */
async function findOwnTicket(ctx: AuthedCtx, registrationId: string): Promise<TicketRow> {
  const row = await findTicket(ctx.db, registrationId);
  if (!row || row.userId !== ctx.user.id) throw ticketNotFound();
  return row;
}

export async function register(
  ctx: AuthedCtx,
  eventId: string,
  now: Date = new Date(),
): Promise<TicketDto> {
  const event = await findVisibleEvent(ctx, eventId);
  const registrationId = await inTransaction(ctx.db, async (tx) => {
    await lockEventRegistrations(tx, event.id);
    const existing = await findRegistration(tx, event.id, ctx.user.id);
    if (existing && existing.status !== "cancelled") {
      throw new AppError("ALREADY_REGISTERED", 409, "Tu es déjà inscrit·e à cet événement.");
    }

    const state = registrationState(event, await countConfirmed(tx, event.id), now);
    if (state === "closed") {
      throw event.status === "published"
        ? new AppError("DEADLINE_PASSED", 409, "Les inscriptions sont closes pour cet événement.")
        : new AppError(
            "REGISTRATION_CLOSED",
            409,
            "Les inscriptions ne sont pas ouvertes pour cet événement.",
          );
    }
    if (state === "full") {
      throw new AppError("EVENT_FULL", 409, "L'événement est complet.");
    }

    if (existing) {
      // Re-registration after a cancellation: same row (unique per event and user), same token.
      await updateRegistration(tx, existing.id, { status: "confirmed", cancelledAt: null });
      return existing.id;
    }
    return insertRegistration(tx, {
      eventId: event.id,
      userId: ctx.user.id,
      status: "confirmed",
      qrToken: newQrToken(),
    });
  });
  return getTicket(ctx, registrationId);
}

export async function cancelRegistration(
  ctx: AuthedCtx,
  registrationId: string,
  now: Date = new Date(),
): Promise<TicketDto> {
  const ticket = await findOwnTicket(ctx, registrationId);
  if (ticket.status === "cancelled") return toTicket(ticket);
  if (!canUnregister(ticket.event, now)) {
    throw new AppError(
      "DEADLINE_PASSED",
      409,
      "L'événement a commencé : tu ne peux plus te désinscrire.",
    );
  }
  await updateRegistration(ctx.db, ticket.id, { status: "cancelled", cancelledAt: now });
  return getTicket(ctx, ticket.id);
}

export async function getTicket(ctx: AuthedCtx, registrationId: string): Promise<TicketDto> {
  return toTicket(await findOwnTicket(ctx, registrationId));
}

export async function listMyTickets(
  ctx: AuthedCtx,
  scope: "upcoming" | "past",
  now: Date = new Date(),
): Promise<TicketDto[]> {
  return (await findUserTickets(ctx.db, ctx.user.id, scope, now)).map(toTicket);
}

// Postgres timestamptz text, e.g. "2026-10-07 14:32:11.123456+00".
const PgTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/);
const RegistrantCursor = z.object({ c: PgTimestamp, id: z.uuid() });

export async function listRegistrants(
  ctx: AuthedCtx,
  eventId: string,
  query: { status?: RegistrationStatus | undefined; cursor?: string | undefined; limit: number },
): Promise<Page<RegistrantDto>> {
  const event = await findManageableEvent(ctx, eventId);
  const after = query.cursor ? decodeCursor(query.cursor, RegistrantCursor) : null;
  const rows = await findRegistrants(ctx.db, {
    eventId: event.id,
    status: query.status,
    after: after ? { createdAtKey: after.c, id: after.id } : null,
    limit: query.limit,
  });
  return toPage(
    rows,
    query.limit,
    ({ createdAtKey: _, ...row }) => ({ ...row, createdAt: row.createdAt.toISOString() }),
    (row) => ({ c: row.createdAtKey, id: row.id }),
  );
}

// --- Read access for other modules (check-in). No authorization here: callers check it. ---

export type Participant = NonNullable<Awaited<ReturnType<typeof findParticipantByToken>>>;

export function participantByToken(ctx: Pick<AuthedCtx, "db">, qrToken: string) {
  return findParticipantByToken(ctx.db, qrToken);
}

export function participantOfEvent(ctx: Pick<AuthedCtx, "db">, eventId: string, userId: string) {
  return findParticipant(ctx.db, eventId, userId);
}

export function searchParticipants(ctx: Pick<AuthedCtx, "db">, eventId: string, query: string) {
  return searchConfirmedParticipants(ctx.db, eventId, query);
}

export function confirmedCount(ctx: Pick<AuthedCtx, "db">, eventId: string) {
  return countConfirmed(ctx.db, eventId);
}
