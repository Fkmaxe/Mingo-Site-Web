import type {
  AttendanceKind,
  CheckinCandidateDto,
  CheckinDto,
  CheckinInput,
  CheckinStatsDto,
} from "@bde/shared";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { emit } from "../../core/events";
import { parisTime } from "../../core/time";
import { inTransaction } from "../../core/tx";
import { findManageableEvent } from "../events";
import {
  confirmedCount,
  participantByToken,
  participantOfEvent,
  searchParticipants,
} from "../registrations";
import {
  countAttendances,
  findAttendance,
  findAttendancesOfUsers,
  findEventAttendances,
  insertAttendance,
} from "./checkin.repo";

const KIND = "participant" as const;

/** Checks a participant in, by QR token or (manual fallback) by user id. Idempotent. */
export async function recordCheckin(
  ctx: AuthedCtx,
  eventId: string,
  input: CheckinInput,
): Promise<CheckinDto> {
  const event = await findManageableEvent(ctx, eventId);
  if (event.status !== "published") {
    throw new AppError(
      "REGISTRATION_CLOSED",
      409,
      "Le pointage n'est possible que pour un événement publié.",
    );
  }

  const participant =
    "qrToken" in input
      ? await participantByToken(ctx, input.qrToken)
      : await participantOfEvent(ctx, event.id, input.userId);
  if (!participant) {
    throw new AppError("TICKET_NOT_VALID", 422, "Billet inconnu.");
  }
  if (participant.eventId !== event.id) {
    throw new AppError("TICKET_NOT_VALID", 422, "Ce billet est pour un autre événement.");
  }
  if (participant.status !== "confirmed") {
    throw new AppError(
      "TICKET_NOT_VALID",
      422,
      participant.status === "waitlisted"
        ? `${participant.user.name} est sur liste d'attente, sans place confirmée.`
        : `L'inscription de ${participant.user.name} a été annulée.`,
    );
  }

  return recordAttendance(ctx, event, participant.user, KIND);
}

type Person = { id: string; name: string; promo: string | null };

/**
 * Records a presence once (409 ALREADY_CHECKED_IN otherwise, also under concurrency) and
 * emits checkin.recorded in the same transaction. Callers check permissions and eligibility.
 */
export async function recordAttendance(
  ctx: AuthedCtx,
  event: { id: string; title: string; openPointsValue: number },
  person: Person,
  kind: AttendanceKind,
): Promise<CheckinDto> {
  const already = (checkedInAt: Date) =>
    new AppError(
      "ALREADY_CHECKED_IN",
      409,
      `${person.name} est déjà entré·e à ${parisTime(checkedInAt)}.`,
      { checkedInAt: checkedInAt.toISOString(), user: person },
    );
  return inTransaction(ctx.db, async (tx) => {
    const existing = await findAttendance(tx, event.id, person.id, kind);
    if (existing) throw already(existing.checkedInAt);

    const created = await insertAttendance(tx, {
      eventId: event.id,
      userId: person.id,
      kind,
      checkedInBy: ctx.user.id,
    });
    if (!created) {
      const winner = await findAttendance(tx, event.id, person.id, kind);
      throw already(winner?.checkedInAt ?? new Date());
    }

    await emit("checkin.recorded", {
      db: tx,
      attendanceId: created.id,
      kind,
      userId: person.id,
      actorUserId: ctx.user.id,
      event: { id: event.id, title: event.title, openPointsValue: event.openPointsValue },
    });

    return {
      attendanceId: created.id,
      kind: created.kind,
      checkedInAt: created.checkedInAt.toISOString(),
      user: { id: person.id, name: person.name, promo: person.promo },
    };
  });
}

export async function searchCheckinCandidates(
  ctx: AuthedCtx,
  eventId: string,
  query: string,
): Promise<CheckinCandidateDto[]> {
  const event = await findManageableEvent(ctx, eventId);
  const participants = await searchParticipants(ctx, event.id, query);
  const attendances = await findAttendancesOfUsers(
    ctx.db,
    event.id,
    participants.map((p) => p.user.id),
    KIND,
  );
  const checkedInAt = new Map(attendances.map((a) => [a.userId, a.checkedInAt.toISOString()]));
  return participants.map((p) => ({
    registrationId: p.id,
    user: p.user,
    checkedInAt: checkedInAt.get(p.user.id) ?? null,
  }));
}

export async function checkinStats(ctx: AuthedCtx, eventId: string): Promise<CheckinStatsDto> {
  const event = await findManageableEvent(ctx, eventId);
  const [confirmed, checkedIn] = await Promise.all([
    confirmedCount(ctx, event.id),
    countAttendances(ctx.db, event.id, KIND),
  ]);
  return { confirmedCount: confirmed, checkedInCount: checkedIn };
}

// --- Read access for other modules (exports). No authorization here: callers check it. ---

export function eventAttendances(ctx: Pick<AuthedCtx, "db">, eventId: string) {
  return findEventAttendances(ctx.db, eventId);
}
