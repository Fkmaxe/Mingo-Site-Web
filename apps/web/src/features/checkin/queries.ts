import "server-only";
import { api } from "@/lib/api";
import type { CheckinStats } from "./types";

export async function getCheckinStats(eventId: string): Promise<CheckinStats> {
  const { data, response } = await (await api()).GET("/v1/events/{eventId}/checkin/stats", {
    params: { path: { eventId } },
  });
  if (!data) throw new Error(`GET checkin/stats a échoué (${response.status})`);
  return data;
}
