"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

/** Creates my subscription link, or a new one replacing it (the old link stops working). */
export async function renewCalendarFeedAction(): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/me/calendar/feed");
  if (error) return fromApiError(error);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function revokeCalendarFeedAction(): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/me/calendar/feed");
  if (error) return fromApiError(error);
  revalidatePath("/calendar");
  return { ok: true };
}
