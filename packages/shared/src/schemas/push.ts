import { z } from "zod";

export const PushConfigDto = z
  .object({
    /** VAPID public key to subscribe with; null when the server has push turned off. */
    publicKey: z.string().nullable(),
  })
  .meta({ id: "PushConfig" });
export type PushConfigDto = z.infer<typeof PushConfigDto>;

/**
 * Push services of the browsers. The API posts to the endpoint a browser gives: only these
 * hosts are accepted, so the server cannot be made to call anything else (SSRF).
 */
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Chromium), Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/, // Safari, iOS
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/, // legacy Edge
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

const PushEndpoint = z
  .url("Adresse de notification invalide")
  .max(2048)
  .refine(isPushServiceEndpoint, "Service de notification non reconnu");

/** What `PushSubscription.toJSON()` gives in the browser, plus the preference. */
export const SubscribePushInput = z
  .object({
    endpoint: PushEndpoint,
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
    newEvents: z.boolean().default(true),
  })
  .meta({ id: "SubscribePushInput" });
export type SubscribePushInput = z.input<typeof SubscribePushInput>;

export const UnsubscribePushInput = z
  .object({ endpoint: z.string().max(2048) })
  .meta({ id: "UnsubscribePushInput" });

export const PushPreferencesInput = z
  .object({ newEvents: z.boolean() })
  .meta({ id: "PushPreferencesInput" });

export const PushStatusDto = z
  .object({
    /** Devices of the user that receive notifications. */
    devices: z.int(),
    newEvents: z.boolean(),
  })
  .meta({ id: "PushStatus" });
export type PushStatusDto = z.infer<typeof PushStatusDto>;
