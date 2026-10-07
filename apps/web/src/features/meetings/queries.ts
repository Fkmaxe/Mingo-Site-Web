import "server-only";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Meeting } from "./types";

export async function listMeetings(scope: "upcoming" | "past"): Promise<Meeting[]> {
  const { data, response } = await (await api()).GET("/v1/meetings", {
    params: { query: { scope } },
  });
  if (!data) throw new Error(`GET /v1/meetings a échoué (${response.status})`);
  return data;
}

export async function getMeetingOr404(meetingId: string): Promise<Meeting> {
  const { data } = await (await api()).GET("/v1/meetings/{meetingId}", {
    params: { path: { meetingId } },
  });
  if (!data) notFound();
  return data;
}
