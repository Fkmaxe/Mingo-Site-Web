import {
  type Answers,
  answersSchema,
  formatAnswer,
  type RegistrantDto,
  type RegistrationStatus,
  type TicketDto,
} from "@bde/shared";
import { z } from "zod";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import type { DomainEvents } from "../../core/events";
import { decodeCursor, type Page, PgTimestampText, toPage } from "../../core/http";
import { inTransactionWithEffects } from "../../core/tx";
import { findManageableEvent, findVisibleEvent } from "../events";
import { confirmedEmail, eventCancelledEmail, waitlistedEmail } from "./registrations.emails";
import {
  countConfirmed,
  findActiveRegistrantContacts,
  findAllRegistrants,
  findParticipant,
  findParticipantByToken,
  findRegistrants,
  findRegistration,
  findTicket,
  findUserTickets,
  findWaitlistRanks,
  insertRegistration,
  lockEventRegistrations,
  maxWaitlistPosition,
  searchConfirmedParticipants,
  type TicketRow,
  updateRegistration,
} from "./registrations.repo";
import { canUnregister, newQrToken, registrationState } from "./rules";
import { eventUrl, fillFreePlaces, ticketUrl } from "./waitlist";

function toTicket(row: TicketRow, waitlistRank: number | null): TicketDto {
  return {
    id: row.id,
    status: row.status,
    qrToken: row.qrToken,
    waitlistPosition: row.status === "waitlisted" ? waitlistRank : null,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    answers: row.answers,
    questions: row.event.customFields.map((field) => ({
      label: field.label,
      answer: formatAnswer(row.answers[field.key]),
    })),
    event: {
      id: row.event.id,
      slug: row.event.slug,
      title: row.event.title,
      location: row.event.location,
      status: row.event.status,
      startsAt: row.event.startsAt.toISOString(),
      endsAt: row.event.endsAt.toISOString(),
    },
  };
}

async function toTickets(ctx: Pick<AuthedCtx, "db">, rows: TicketRow[]): Promise<TicketDto[]> {
  const ranks = await findWaitlistRanks(
    ctx.db,
    rows.filter((r) => r.status === "waitlisted").map((r) => r.id),
  );
  return rows.map((row) => toTicket(row, ranks.get(row.id) ?? null));
}

const ticketNotFound = () => new AppError("NOT_FOUND", 404, "Ce billet n'existe pas.");

/** Own ticket only: someone else's registration is reported as missing. */
async function findOwnTicket(ctx: AuthedCtx, registrationId: string): Promise<TicketRow> {
  const row = await findTicket(ctx.db, registrationId);
  if (!row || row.userId !== ctx.user.id) throw ticketNotFound();
  return row;
}

/**
 * Registers the current user: confirmed while there is room, waitlisted once the event is
 * full (rule 2). Mails the outcome after the commit.
 */
export async function register(
  ctx: AuthedCtx,
  eventId: string,
  input: { answers: Record<string, unknown> } = { answers: {} },
  now: Date = new Date(),
): Promise<TicketDto> {
  const event = await findVisibleEvent(ctx, eventId);
  const parsed = answersSchema(event.customFieldsSchema).safeParse(input.answers);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", 400, "Certaines réponses sont invalides.", {
      issues: parsed.error.issues.map((i) => ({ ...i, path: ["answers", ...i.path] })),
    });
  }
  // The schema built from the fields only admits strings, numbers and booleans.
  const answers = parsed.data as Answers;
  const registrationId = await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await lockEventRegistrations(tx, event.id);
    const existing = await findRegistration(tx, event.id, ctx.user.id);
    if (existing && existing.status !== "cancelled") {
      throw new AppError(
        "ALREADY_REGISTERED",
        409,
        existing.status === "waitlisted"
          ? "Tu es déjà sur la liste d'attente de cet événement."
          : "Tu es déjà inscrit·e à cet événement.",
      );
    }
    // Places freed without promotion (should not happen) go to the waitlist first.
    await fillFreePlaces(tx, event, defer, ctx.services);

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
    const waitlisted = state === "full";
    const values = {
      status: waitlisted ? ("waitlisted" as const) : ("confirmed" as const),
      waitlistPosition: waitlisted ? (await maxWaitlistPosition(tx, event.id)) + 1 : null,
      cancelledAt: null,
      answers,
    };
    // Re-registration after a cancellation: same row (unique per event and user), same token.
    let id: string;
    if (existing) {
      await updateRegistration(tx, existing.id, values);
      id = existing.id;
    } else {
      id = await insertRegistration(tx, {
        eventId: event.id,
        userId: ctx.user.id,
        qrToken: newQrToken(),
        ...values,
      });
    }

    const person = { name: ctx.user.name, email: ctx.user.email };
    if (waitlisted) {
      const [rank] = (await findWaitlistRanks(tx, [id])).values();
      defer(() =>
        ctx.services.mailer.send(
          waitlistedEmail(person, event, rank ?? 1, eventUrl(ctx.services, event.slug)),
        ),
      );
    } else {
      defer(() =>
        ctx.services.mailer.send(confirmedEmail(person, event, ticketUrl(ctx.services, id))),
      );
    }
    return id;
  });
  return getTicket(ctx, registrationId);
}

/** Unregisters; a confirmed place goes to the first waitlisted person (rule 3). */
export async function cancelRegistration(
  ctx: AuthedCtx,
  registrationId: string,
  now: Date = new Date(),
): Promise<TicketDto> {
  const ticket = await findOwnTicket(ctx, registrationId);
  if (ticket.status === "cancelled") return getTicket(ctx, ticket.id);
  if (!canUnregister(ticket.event, now)) {
    throw new AppError(
      "DEADLINE_PASSED",
      409,
      "L'événement a commencé : tu ne peux plus te désinscrire.",
    );
  }
  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await lockEventRegistrations(tx, ticket.event.id);
    await updateRegistration(tx, ticket.id, {
      status: "cancelled",
      cancelledAt: now,
      waitlistPosition: null,
    });
    if (ticket.status === "confirmed") {
      await fillFreePlaces(tx, ticket.event, defer, ctx.services);
    }
  });
  return getTicket(ctx, ticket.id);
}

export async function getTicket(ctx: AuthedCtx, registrationId: string): Promise<TicketDto> {
  const [ticket] = await toTickets(ctx, [await findOwnTicket(ctx, registrationId)]);
  if (!ticket) throw ticketNotFound();
  return ticket;
}

export async function listMyTickets(
  ctx: AuthedCtx,
  scope: "upcoming" | "past",
  now: Date = new Date(),
): Promise<TicketDto[]> {
  return toTickets(ctx, await findUserTickets(ctx.db, ctx.user.id, scope, now));
}

const RegistrantCursor = z.object({ c: PgTimestampText, id: z.uuid() });

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

export function allRegistrants(ctx: Pick<AuthedCtx, "db">, eventId: string) {
  return findAllRegistrants(ctx.db, eventId);
}

// --- Domain event subscribers (registered in index.ts) ---

/** Capacity change: refused below the confirmed count, otherwise free places are given out. */
export async function onEventUpdated(payload: DomainEvents["event.updated"]) {
  const { db, event } = payload;
  if (event.capacity === payload.previousCapacity) return;
  await lockEventRegistrations(db, event.id);
  const confirmed = await countConfirmed(db, event.id);
  if (event.capacity !== null && event.capacity < confirmed) {
    throw new AppError(
      "CAPACITY_BELOW_REGISTRATIONS",
      409,
      `${confirmed} personnes sont déjà inscrites : la capacité ne peut pas descendre en dessous.`,
    );
  }
  await fillFreePlaces(db, event, payload.defer, payload.services);
}

/** Cancelled event: every confirmed or waitlisted person is told, after the commit. */
export async function onEventCancelled(payload: DomainEvents["event.cancelled"]) {
  const contacts = await findActiveRegistrantContacts(payload.db, payload.event.id);
  const url = `${payload.services.webOrigin}/events`;
  for (const contact of contacts) {
    payload.defer(() =>
      payload.services.mailer.send(eventCancelledEmail(contact.user, payload.event, url)),
    );
  }
}
