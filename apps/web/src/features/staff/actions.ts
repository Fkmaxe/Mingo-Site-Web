"use server";

import type { CreateStaffSlotInput } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

function revalidateStaff() {
  revalidatePath("/events", "layout");
  revalidatePath("/manage/events", "layout");
}

async function done(promise: Promise<{ error?: Parameters<typeof fromApiError>[0] }>) {
  const { error } = await promise;
  if (error) return fromApiError(error);
  revalidateStaff();
  return { ok: true } as const;
}

export async function createSlotAction(
  eventId: string,
  input: CreateStaffSlotInput,
): Promise<ActionResult> {
  const client = await api();
  return done(
    client.POST("/v1/events/{eventId}/staff-slots", { params: { path: { eventId } }, body: input }),
  );
}

export async function deleteSlotAction(slotId: string): Promise<ActionResult> {
  const client = await api();
  return done(client.DELETE("/v1/staff-slots/{slotId}", { params: { path: { slotId } } }));
}

export async function volunteerAction(
  slotId: string,
  action: "volunteer" | "withdraw",
): Promise<ActionResult> {
  const client = await api();
  const path =
    action === "volunteer"
      ? "/v1/staff-slots/{slotId}/volunteer"
      : "/v1/staff-slots/{slotId}/withdraw";
  return done(client.POST(path, { params: { path: { slotId } } }));
}

export async function decideAssignmentAction(
  assignmentId: string,
  decision: "validate" | "decline" | "checkin",
): Promise<ActionResult> {
  const client = await api();
  const params = { params: { path: { assignmentId } } };
  if (decision === "validate") {
    return done(client.POST("/v1/staff-assignments/{assignmentId}/validate", params));
  }
  if (decision === "decline") {
    return done(client.POST("/v1/staff-assignments/{assignmentId}/decline", params));
  }
  return done(client.POST("/v1/staff-assignments/{assignmentId}/checkin", params));
}
