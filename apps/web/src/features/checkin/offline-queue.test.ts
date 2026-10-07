import { describe, expect, it } from "vitest";
import { enqueue, readQueue, removeFromQueue } from "./offline-queue";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("offline check-in queue", () => {
  it("queues each ticket once, per event", () => {
    const store = memoryStore();
    enqueue(store, "e1", "tok-a", new Date("2026-10-10T20:00:00Z"));
    enqueue(store, "e1", "tok-a");
    enqueue(store, "e1", "tok-b");
    enqueue(store, "e2", "tok-c");
    expect(readQueue(store, "e1").map((s) => s.qrToken)).toEqual(["tok-a", "tok-b"]);
    expect(readQueue(store, "e1")[0]?.scannedAt).toBe("2026-10-10T20:00:00.000Z");
    expect(readQueue(store, "e2")).toHaveLength(1);
  });

  it("removes sent scans and forgets the key when empty", () => {
    const store = memoryStore();
    enqueue(store, "e1", "tok-a");
    enqueue(store, "e1", "tok-b");
    expect(removeFromQueue(store, "e1", ["tok-a"]).map((s) => s.qrToken)).toEqual(["tok-b"]);
    removeFromQueue(store, "e1", ["tok-b"]);
    expect(store.data.size).toBe(0);
  });

  it("ignores corrupted data", () => {
    const store = memoryStore();
    store.setItem("bde-checkin-queue:e1", "{not json");
    expect(readQueue(store, "e1")).toEqual([]);
    store.setItem("bde-checkin-queue:e1", JSON.stringify([{ qrToken: 1 }]));
    expect(readQueue(store, "e1")).toEqual([]);
  });
});
