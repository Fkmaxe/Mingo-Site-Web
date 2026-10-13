import "server-only";
import { api } from "@/lib/api";
import type { EventLeague, League, MyLeague } from "./types";

export async function getLeague(filter: { levelId?: string; trackId?: string }): Promise<League> {
  const { data, response } = await (await api()).GET("/v1/league", {
    params: { query: filter },
  });
  if (!data) throw new Error(`GET /v1/league a échoué (${response.status})`);
  return data;
}

/** League part of an event page: null for visitors (it needs a session). */
export async function getEventLeague(ref: string): Promise<EventLeague | null> {
  const { data, response } = await (await api()).GET("/v1/events/{eventRef}/league", {
    params: { path: { eventRef: ref } },
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!data) throw new Error(`GET /v1/events/${ref}/league a échoué (${response.status})`);
  return data;
}

export async function getMyLeague(): Promise<MyLeague> {
  const { data, response } = await (await api()).GET("/v1/league/me");
  if (!data) throw new Error(`GET /v1/league/me a échoué (${response.status})`);
  return data;
}
