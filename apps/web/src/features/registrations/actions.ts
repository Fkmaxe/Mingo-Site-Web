"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

function revalidateRegistrations() {
  revalidatePath("/events", "layout");
  revalidatePath("/tickets", "layout");
  revalidatePath("/home");
}

export async function registerAction(
  eventId: string,
  answers: Record<string, string | number | boolean> = {},
): Promise<ActionResult & { registrationId?: string }> {
  const { data, error } = await (await api()).POST("/v1/events/{eventId}/registrations", {
    params: { path: { eventId } },
    body: { answers },
  });
  if (error) return fromApiError(error);
  revalidateRegistrations();
  return { ok: true, registrationId: data.id };
}

export async function cancelRegistrationAction(registrationId: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/registrations/{registrationId}/cancel", {
    params: { path: { registrationId } },
  });
  if (error) return fromApiError(error);
  revalidateRegistrations();
  return { ok: true };
}
