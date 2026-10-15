import "server-only";
import { api } from "@/lib/api";
import type { CalendarItem } from "./types";

/** My calendar between two Paris days (inclusive, 62 days at most). */
export async function getCalendar(from: string, to: string): Promise<CalendarItem[]> {
  const { data, response } = await (await api()).GET("/v1/me/calendar", {
    params: { query: { from, to } },
  });
  if (!data) throw new Error(`GET /v1/me/calendar a échoué (${response.status})`);
  return data;
}

/** My iCal subscription link, or null until I create it. */
export async function getCalendarFeedUrl(): Promise<string | null> {
  const { data, response } = await (await api()).GET("/v1/me/calendar/feed");
  if (!data) throw new Error(`GET /v1/me/calendar/feed a échoué (${response.status})`);
  return data.url;
}
