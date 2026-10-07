"use server";

import type { CreateEventData } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

function revalidateEvents() {
  revalidatePath("/events", "layout");
  revalidatePath("/manage/events", "layout");
  revalidatePath("/home");
}

/** `input` is the form data already parsed by the shared schema (defaults applied). */
export async function createEventAction(input: CreateEventData): Promise<ActionResult> {
  const { data, error } = await (await api()).POST("/v1/events", { body: input });
  if (error) return fromApiError(error);
  revalidateEvents();
  redirect(`/manage/events/${data.id}?created=1`);
}

export async function updateEventAction(
  eventId: string,
  input: CreateEventData,
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/events/{eventId}", {
    params: { path: { eventId } },
    body: input,
  });
  if (error) return fromApiError(error);
  revalidateEvents();
  return { ok: true };
}

export async function publishEventAction(eventId: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/publish", {
    params: { path: { eventId } },
  });
  if (error) return fromApiError(error);
  revalidateEvents();
  return { ok: true };
}

export async function cancelEventAction(eventId: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/cancel", {
    params: { path: { eventId } },
  });
  if (error) return fromApiError(error);
  revalidateEvents();
  return { ok: true };
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/events/{eventId}", {
    params: { path: { eventId } },
  });
  if (error) return fromApiError(error);
  revalidateEvents();
  redirect("/manage/events");
}
