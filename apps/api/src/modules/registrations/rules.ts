import { randomBytes } from "node:crypto";
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
