"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

export async function subscribePushAction(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  newEvents: boolean;
}): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/me/push/subscriptions", { body: subscription });
  if (error) return fromApiError(error);
  revalidatePath("/profile");
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/me/push/unsubscribe", { body: { endpoint } });
  if (error) return fromApiError(error);
  revalidatePath("/profile");
  return { ok: true };
}

export async function setNewEventsAction(newEvents: boolean): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/me/push", { body: { newEvents } });
  if (error) return fromApiError(error);
  revalidatePath("/profile");
  return { ok: true };
}
