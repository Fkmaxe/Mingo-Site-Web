import webpush from "web-push";
import type { Pusher, PushMessage, PushResult, PushTarget } from "./pusher";

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

const TIMEOUT_MS = 10_000;

/**
 * Web Push with VAPID keys (`npx web-push generate-vapid-keys`). web-push encrypts and signs
 * the message; it is sent with fetch, without following redirects. Endpoints are checked when
 * a device subscribes (known push services only, see SubscribePushInput).
 */
export function createWebPusher(vapid: VapidConfig): Pusher {
  const options = { vapidDetails: vapid, TTL: 24 * 3600, urgency: "normal" as const };
  return {
    enabled: true,
    publicKey: vapid.publicKey,
    async send(target: PushTarget, message: PushMessage): Promise<PushResult> {
      try {
        const request = webpush.generateRequestDetails(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          options,
        );
        const response = await fetch(request.endpoint, {
          method: request.method,
          headers: request.headers,
          body: request.body ? new Uint8Array(request.body) : null,
          redirect: "error",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.ok) return "sent";
        // 404 / 410: the subscription expired or was revoked by the user.
        if (response.status === 404 || response.status === 410) return "gone";
        console.error("Notification push refusée", response.status);
        return "failed";
      } catch (error) {
        console.error("Notification push en échec", error);
        return "failed";
      }
    },
  };
}

/** Without VAPID keys: notifications are off, nothing is sent. */
export function createDisabledPusher(): Pusher {
  return { enabled: false, publicKey: null, send: async () => "failed" };
}
