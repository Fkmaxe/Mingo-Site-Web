"use server";

import type { CreateMeetingData } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

export async function createMeetingAction(input: CreateMeetingData): Promise<ActionResult> {
  const { data, error } = await (await api()).POST("/v1/meetings", { body: input });
  if (error) return fromApiError(error);
  revalidatePath("/meetings", "layout");
  redirect(`/meetings/${data.id}`);
}

/** The edit form always sends every field. */
type MeetingEdit = {
  title: string;
  startsAt: string;
  location: string;
  agenda: string;
  minutes: string;
};

export async function updateMeetingAction(
  meetingId: string,
  input: MeetingEdit,
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/meetings/{meetingId}", {
    params: { path: { meetingId } },
    body: input,
  });
  if (error) return fromApiError(error);
  revalidatePath("/meetings", "layout");
  return { ok: true };
}

export async function setAttendanceAction(
  meetingId: string,
  userId: string,
  present: boolean,
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/meetings/{meetingId}/attendance", {
    params: { path: { meetingId } },
    body: { userId, present },
  });
  if (error) return fromApiError(error);
  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

export async function deleteMeetingAction(meetingId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/meetings/{meetingId}", {
    params: { path: { meetingId } },
  });
  if (error) return fromApiError(error);
  revalidatePath("/meetings", "layout");
  redirect("/meetings");
}
