import type { Pusher, PushMessage, PushResult, PushTarget } from "./pusher";

export type MemoryPusher = Pusher & {
  sent: { endpoint: string; message: PushMessage }[];
  /** Endpoints answered as revoked (410). */
  gone: Set<string>;
};

/** Test double: records notifications instead of sending them. */
export function createMemoryPusher(): MemoryPusher {
  const sent: MemoryPusher["sent"] = [];
  const gone = new Set<string>();
  return {
    enabled: true,
    publicKey: "test-public-key",
    sent,
    gone,
    async send(target: PushTarget, message: PushMessage): Promise<PushResult> {
      if (gone.has(target.endpoint)) return "gone";
      sent.push({ endpoint: target.endpoint, message });
      return "sent";
    },
  };
}
