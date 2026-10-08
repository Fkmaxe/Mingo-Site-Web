import type { AttendanceKind } from "@bde/shared";
import type { DbOrTx } from "../db/client";
import type { Services } from "./context";
import type { Defer } from "./tx";

type EventRef = { id: string; slug: string; title: string; startsAt: Date; location: string };

/**
 * Internal domain events. Handlers run synchronously, in the emitter's transaction (`db`):
 * if one fails, the whole operation is rolled back. Side effects outside the database
 * (mails) go through `defer`, which runs them after the commit.
 */
export type DomainEvents = {
  "event.updated": {
    db: DbOrTx;
    defer: Defer;
    services: Services;
    event: EventRef & {
      status: string;
      capacity: number | null;
      teamMinSize: number | null;
      teamMaxSize: number | null;
    };
    previousCapacity: number | null;
    previousTeamMaxSize: number | null;
  };
  "event.cancelled": { db: DbOrTx; defer: Defer; services: Services; event: EventRef };
  "checkin.recorded": {
    db: DbOrTx;
    attendanceId: string;
    kind: AttendanceKind;
    userId: string;
    actorUserId: string;
    event: { id: string; title: string; openPointsValue: number };
  };
};

type EventName = keyof DomainEvents;
type Handler<K extends EventName> = (payload: DomainEvents[K]) => Promise<void>;

const handlers: { [K in EventName]: Handler<K>[] } = {
  "event.updated": [],
  "event.cancelled": [],
  "checkin.recorded": [],
};

/** Subscribes a handler. Modules subscribe once, from their index.ts. */
export function on<K extends EventName>(name: K, handler: Handler<K>): void {
  handlers[name].push(handler);
}

export async function emit<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void> {
  for (const handler of handlers[name]) await handler(payload);
}
