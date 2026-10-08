import type { PushStatusDto, SubscribePushInput } from "@bde/shared";
import type { AuthedCtx, Services } from "../../core/context";
import type { DbOrTx } from "../../db/client";
import type { PushMessage, PushTarget } from "../../lib/push";
import {
  deleteSubscription,
  deleteSubscriptionsByEndpoint,
  findNewEventTargets,
  findTargetsOfUsers,
  findUserSubscriptions,
  markSent,
  setNewEvents,
  upsertSubscription,
} from "./push.repo";

export type PushDeps = { db: DbOrTx; services: Pick<Services, "pusher"> };

const CONCURRENCY = 10;

/** Sends to every target (10 at a time); revoked subscriptions are deleted. Returns sent count. */
export async function deliver(
  deps: PushDeps,
  targets: PushTarget[],
  message: PushMessage,
  now: Date = new Date(),
): Promise<number> {
  const { pusher } = deps.services;
  if (!pusher.enabled || targets.length === 0) return 0;
  const sent: string[] = [];
  const gone: string[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((t) => pusher.send(t, message)));
    results.forEach((result, j) => {
      const endpoint = batch[j]?.endpoint;
      if (!endpoint) return;
      if (result === "sent") sent.push(endpoint);
      if (result === "gone") gone.push(endpoint);
    });
  }
  await deleteSubscriptionsByEndpoint(deps.db, gone);
  await markSent(deps.db, sent, now);
  return sent.length;
}

/** Personal notification to some users (all their devices). Call it after the commit. */
export async function notifyUsers(
  deps: PushDeps,
  userIds: string[],
  message: PushMessage,
): Promise<number> {
  if (!deps.services.pusher.enabled) return 0;
  return deliver(deps, await findTargetsOfUsers(deps.db, [...new Set(userIds)]), message);
}

/** Announces a published event to the devices opted in that may see it. */
export async function announceEvent(
  deps: PushDeps,
  event: { visibility: string; publishedBy: string },
  message: PushMessage,
): Promise<number> {
  if (!deps.services.pusher.enabled) return 0;
  const targets = await findNewEventTargets(
    deps.db,
    event.visibility === "members",
    event.publishedBy,
  );
  return deliver(deps, targets, message);
}

// --- Routes ---

export function getPushConfig(ctx: Pick<AuthedCtx, "services">) {
  return { publicKey: ctx.services.pusher.publicKey };
}

export async function getPushStatus(ctx: AuthedCtx): Promise<PushStatusDto> {
  const subscriptions = await findUserSubscriptions(ctx.db, ctx.user.id);
  return {
    devices: subscriptions.length,
    // A user without devices gets new events by default once they subscribe.
    newEvents: subscriptions.length === 0 || subscriptions.some((s) => s.newEvents),
  };
}

export async function subscribePush(
  ctx: AuthedCtx,
  input: { endpoint: string; keys: SubscribePushInput["keys"]; newEvents: boolean },
): Promise<PushStatusDto> {
  await upsertSubscription(ctx.db, {
    userId: ctx.user.id,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    newEvents: input.newEvents,
  });
  return getPushStatus(ctx);
}

export async function unsubscribePush(ctx: AuthedCtx, endpoint: string): Promise<PushStatusDto> {
  await deleteSubscription(ctx.db, ctx.user.id, endpoint);
  return getPushStatus(ctx);
}

export async function setPushPreferences(
  ctx: AuthedCtx,
  input: { newEvents: boolean },
): Promise<PushStatusDto> {
  await setNewEvents(ctx.db, ctx.user.id, input.newEvents);
  return getPushStatus(ctx);
}
