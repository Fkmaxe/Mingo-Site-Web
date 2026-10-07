import { z } from "zod";

/** Scans made without network, kept on the phone until they can be sent. */
const QueuedScan = z.object({ qrToken: z.string().min(1), scannedAt: z.iso.datetime() });
export type QueuedScan = z.infer<typeof QueuedScan>;

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyOf = (eventId: string) => `bde-checkin-queue:${eventId}`;

export function readQueue(store: KeyValueStore, eventId: string): QueuedScan[] {
  try {
    const parsed = z.array(QueuedScan).safeParse(JSON.parse(store.getItem(keyOf(eventId)) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(store: KeyValueStore, eventId: string, queue: QueuedScan[]) {
  if (queue.length === 0) store.removeItem(keyOf(eventId));
  else store.setItem(keyOf(eventId), JSON.stringify(queue));
}

/** Adds a scan; the same ticket is only queued once. Returns the new queue. */
export function enqueue(
  store: KeyValueStore,
  eventId: string,
  qrToken: string,
  now: Date = new Date(),
): QueuedScan[] {
  const queue = readQueue(store, eventId);
  if (!queue.some((s) => s.qrToken === qrToken)) {
    queue.push({ qrToken, scannedAt: now.toISOString() });
  }
  write(store, eventId, queue);
  return queue;
}

export function removeFromQueue(store: KeyValueStore, eventId: string, qrTokens: string[]) {
  const done = new Set(qrTokens);
  const queue = readQueue(store, eventId).filter((s) => !done.has(s.qrToken));
  write(store, eventId, queue);
  return queue;
}
