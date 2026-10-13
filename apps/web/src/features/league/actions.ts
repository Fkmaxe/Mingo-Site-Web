"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { MatchResult } from "./types";

/** Tournament, results and standings show on these pages. */
const done = (): ActionResult => {
  revalidatePath("/ligue");
  revalidatePath("/manage/events/[eventId]", "page");
  revalidatePath("/events/[slug]", "page");
  return { ok: true };
};

const ok = (error: Parameters<typeof fromApiError>[0] | undefined) =>
  error ? fromApiError(error) : done();

export async function saveSeasonAction(input: {
  name: string;
  prizes: string;
  placementPoints: number[];
  participationPoints: number;
}): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/league", { body: input });
  return ok(error);
}

export async function createSportAction(name: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/league/sports", { body: { name } });
  return ok(error);
}

export async function editSportAction(id: string, name: string): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/league/sports/{id}", {
    params: { path: { id } },
    body: { name },
  });
  return ok(error);
}

export async function setLeagueSportAction(
  eventId: string,
  sportId: string | null,
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/events/{eventId}/league", {
    params: { path: { eventId } },
    body: { sportId },
  });
  return ok(error);
}

export async function createTournamentAction(
  eventId: string,
  input: {
    format: "pools_bracket" | "pools" | "bracket";
    source: "checked_in" | "registered";
    poolCount: number;
    qualifiersPerPool: number;
    thirdPlace: boolean;
  },
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/tournament", {
    params: { path: { eventId } },
    body: input,
  });
  return ok(error);
}

export async function deleteTournamentAction(eventId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/events/{eventId}/tournament", {
    params: { path: { eventId } },
  });
  return ok(error);
}

export async function drawBracketAction(eventId: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/tournament/bracket", {
    params: { path: { eventId } },
  });
  return ok(error);
}

export async function recordMatchAction(
  matchId: string,
  input: { result: MatchResult | null; scoreA: number | null; scoreB: number | null },
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/tournament-matches/{id}", {
    params: { path: { id: matchId } },
    body: input,
  });
  return ok(error);
}

export async function validateResultsAction(
  eventId: string,
  placements: { place: number; userId?: string; teamId?: string }[],
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/events/{eventId}/league/results", {
    params: { path: { eventId } },
    body: { placements },
  });
  return ok(error);
}
