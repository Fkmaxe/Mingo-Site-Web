import "server-only";
import { api } from "@/lib/api";
import type { EventStats, MemberInvolvement, YearOverview } from "./types";

export async function getEventStats(eventId: string): Promise<EventStats | null> {
  const { data } = await (await api()).GET("/v1/events/{eventId}/stats", {
    params: { path: { eventId } },
  });
  return data ?? null;
}

export async function getYearOverview(): Promise<YearOverview> {
  const { data, response } = await (await api()).GET("/v1/stats/overview");
  if (!data) throw new Error(`GET /v1/stats/overview a échoué (${response.status})`);
  return data;
}

export async function getMemberInvolvement(): Promise<MemberInvolvement> {
  const { data, response } = await (await api()).GET("/v1/stats/members");
  if (!data) throw new Error(`GET /v1/stats/members a échoué (${response.status})`);
  return data;
}
