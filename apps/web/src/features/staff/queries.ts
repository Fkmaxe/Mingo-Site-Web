import "server-only";
import { api } from "@/lib/api";
import type { StaffSlot } from "./types";

export async function listStaffSlots(eventId: string): Promise<StaffSlot[]> {
  const { data, response } = await (await api()).GET("/v1/events/{eventId}/staff-slots", {
    params: { path: { eventId } },
  });
  if (!data) throw new Error(`GET staff-slots a échoué (${response.status})`);
  return data;
}
