import { randomBytes, randomInt } from "node:crypto";
import type { EventStatus, RegistrationState } from "@bde/shared";

type EventForRegistration = {
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  registrationDeadline: Date | null;
  capacity: number | null;
};

/** Registrations close at the deadline, or at the end of the event when there is none. */
export function registrationClosesAt(event: EventForRegistration): Date {
  return event.registrationDeadline ?? event.endsAt;
}

export function registrationState(
  event: EventForRegistration,
  confirmedCount: number,
  now: Date,
): RegistrationState {
  if (event.status !== "published") return "closed";
  if (now.getTime() > registrationClosesAt(event).getTime()) return "closed";
  if (event.capacity !== null && confirmedCount >= event.capacity) return "full";
  return "open";
}

/** A participant may unregister until the event starts. */
export function canUnregister(event: Pick<EventForRegistration, "startsAt">, now: Date): boolean {
  return now.getTime() < event.startsAt.getTime();
}

/** 32 random bytes in base64url (docs/api-conventions.md), never derived from an id. */
export function newQrToken(): string {
  return randomBytes(32).toString("base64url");
}

type TeamSizes = { teamMinSize: number | null; teamMaxSize: number | null };

/** A team event (tournament) has both sizes; people register by creating or joining a team. */
export function isTeamEvent(
  event: TeamSizes,
): event is { teamMinSize: number; teamMaxSize: number } {
  return event.teamMinSize !== null && event.teamMaxSize !== null;
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 6 characters, without look-alikes (0/O, 1/I), to be read out loud or typed on a phone. */
export function newJoinCode(): string {
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)],
  ).join("");
}

/** Room is counted on active members (confirmed or waitlisted), not confirmed ones only. */
export function teamIsFull(activeMembers: number, maxSize: number): boolean {
  return activeMembers >= maxSize;
}

export function teamIsComplete(confirmedMembers: number, minSize: number): boolean {
  return confirmedMembers >= minSize;
}

/** When the captain leaves, the earliest remaining member takes over; null: the team is empty. */
export function nextCaptain<T extends { userId: string; joinedAt: Date }>(
  remaining: T[],
): string | null {
  const [first] = [...remaining].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  return first?.userId ?? null;
}
