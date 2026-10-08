export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** What the service worker shows. `url` is opened on tap (path on the web origin). */
export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** `gone`: the browser revoked the subscription, it must be deleted. */
export type PushResult = "sent" | "gone" | "failed";

/** Outgoing Web Push. Implementations: web-push (VAPID), disabled, in-memory in tests. */
export interface Pusher {
  readonly enabled: boolean;
  /** VAPID public key the browser subscribes with; null when push is not configured. */
  readonly publicKey: string | null;
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}

/**
 * App-level notifications, bound to the connection pool: safe to call after a commit (from a
 * deferred effect). Implemented by the push module.
 */
export interface Notifier {
  /** Personal notification to every device of these users. */
  notifyUsers(userIds: string[], message: PushMessage): Promise<number>;
  /** New published event, to the opted-in devices that may see it (except its publisher). */
  announceEvent(
    event: { visibility: string; publishedBy: string },
    message: PushMessage,
  ): Promise<number>;
}
