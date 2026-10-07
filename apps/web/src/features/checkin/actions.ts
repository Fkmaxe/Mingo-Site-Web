"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { CheckinCandidate, CheckinStats, ScanOutcome } from "./types";

async function stats(eventId: string): Promise<CheckinStats | null> {
  const { data } = await (await api()).GET("/v1/events/{eventId}/checkin/stats", {
    params: { path: { eventId } },
  });
  return data ?? null;
}

/** Checks in by QR token or user id and describes the outcome for the door screen. */
export async function checkinAction(
  eventId: string,
  input: { qrToken: string } | { userId: string },
): Promise<{ outcome: ScanOutcome; stats: CheckinStats | null }> {
  const { data, error } = await (await api()).POST("/v1/events/{eventId}/checkin", {
    params: { path: { eventId } },
    body: input,
  });
  let outcome: ScanOutcome;
  if (data) {
    outcome = {
      tone: "success",
      title: data.user.name,
      detail: data.user.promo ? `Bienvenue ! Promo ${data.user.promo}` : "Bienvenue !",
    };
    revalidatePath(`/manage/events/${eventId}`);
  } else if (error.error.code === "ALREADY_CHECKED_IN") {
    outcome = { tone: "warning", title: "Déjà entré·e", detail: error.error.message };
  } else {
    outcome = { tone: "error", title: "Entrée refusée", detail: error.error.message };
  }
  return { outcome, stats: await stats(eventId) };
}

export async function searchCandidatesAction(
  eventId: string,
  query: string,
): Promise<{ candidates: CheckinCandidate[]; error: string | null }> {
  const { data, error } = await (await api()).GET("/v1/events/{eventId}/checkin/search", {
    params: { path: { eventId }, query: { q: query } },
  });
  if (error) return { candidates: [], error: error.error.message };
  return { candidates: data, error: null };
}
