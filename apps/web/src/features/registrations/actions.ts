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

export async function createTeamAction(
  eventId: string,
  name: string,
  answers: Record<string, string | number | boolean> = {},
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/teams", {
    params: { path: { eventId } },
    body: { name, answers },
  });
  if (error) return fromApiError(error);
  revalidateRegistrations();
  return { ok: true };
}

export async function joinTeamAction(
  eventId: string,
  code: string,
  answers: Record<string, string | number | boolean> = {},
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/teams/join", {
    params: { path: { eventId } },
    body: { code, answers },
  });
  if (error) return fromApiError(error);
  revalidateRegistrations();
  return { ok: true };
}
