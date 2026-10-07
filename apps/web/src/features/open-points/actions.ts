"use server";

import type { AdjustOpenPointsInput } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { OpenPointsAccount } from "./types";

function revalidateOpenPoints() {
  revalidatePath("/manage/open-points", "layout");
  revalidatePath("/points");
}

export async function decideAction(
  decision: "validate" | "reject",
  ids: string[],
): Promise<ActionResult & { updated?: number; skipped?: number }> {
  const path = decision === "validate" ? "/v1/open-points/validate" : "/v1/open-points/reject";
  const { data, error } = await (await api()).POST(path, { body: { ids } });
  if (error) return fromApiError(error);
  revalidateOpenPoints();
  return { ok: true, updated: data.updated, skipped: data.skipped };
}

export async function adjustAction(input: AdjustOpenPointsInput): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/open-points/adjustments", { body: input });
  if (error) return fromApiError(error);
  revalidateOpenPoints();
  return { ok: true };
}

export async function searchAccountsAction(
  query: string,
): Promise<{ accounts: OpenPointsAccount[]; error: string | null }> {
  const { data, error } = await (await api()).GET("/v1/open-points/accounts", {
    params: { query: { q: query } },
  });
  if (error) return { accounts: [], error: error.error.message };
  return { accounts: data, error: null };
}
