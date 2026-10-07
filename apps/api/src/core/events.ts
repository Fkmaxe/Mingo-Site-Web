import type { AttendanceKind } from "@bde/shared";
import type { DbOrTx } from "../db/client";

/**
 * Internal domain events. Handlers run synchronously, in the emitter's transaction (`db`):
 * if one fails, the whole operation is rolled back.
 */
export type DomainEvents = {
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

const handlers: { [K in EventName]: Handler<K>[] } = { "checkin.recorded": [] };

/** Subscribes a handler. Modules subscribe once, from their index.ts. */
export function on<K extends EventName>(name: K, handler: Handler<K>): void {
  handlers[name].push(handler);
}

export async function emit<K extends EventName>(name: K, payload: DomainEvents[K]): Promise<void> {
  for (const handler of handlers[name]) await handler(payload);
}
