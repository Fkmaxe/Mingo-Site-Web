import type { CheckinCandidateDto, CheckinDto, CheckinInput, CheckinStatsDto } from "@bde/shared";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { emit } from "../../core/events";
import { parisTime } from "../../core/time";
import { inTransaction } from "../../core/tx";
import { findManageableEvent } from "../events";
import {
  confirmedCount,
  type Participant,
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

function alreadyCheckedIn(participant: Participant, checkedInAt: Date) {
  return new AppError(
    "ALREADY_CHECKED_IN",
    409,
    `${participant.user.name} est déjà entré·e à ${parisTime(checkedInAt)}.`,
    { checkedInAt: checkedInAt.toISOString(), user: participant.user },
  );
}

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

  return inTransaction(ctx.db, async (tx) => {
    const existing = await findAttendance(tx, event.id, participant.user.id, KIND);
    if (existing) throw alreadyCheckedIn(participant, existing.checkedInAt);

    const created = await insertAttendance(tx, {
      eventId: event.id,
      userId: participant.user.id,
      kind: KIND,
      checkedInBy: ctx.user.id,
    });
    if (!created) {
      const winner = await findAttendance(tx, event.id, participant.user.id, KIND);
      throw alreadyCheckedIn(participant, winner?.checkedInAt ?? new Date());
    }

    await emit("checkin.recorded", {
      db: tx,
      attendanceId: created.id,
      kind: KIND,
      userId: participant.user.id,
      actorUserId: ctx.user.id,
      event: { id: event.id, title: event.title, openPointsValue: event.openPointsValue },
    });

    return {
      attendanceId: created.id,
      kind: created.kind,
      checkedInAt: created.checkedInAt.toISOString(),
      user: { id: participant.user.id, name: participant.user.name, promo: participant.user.promo },
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
