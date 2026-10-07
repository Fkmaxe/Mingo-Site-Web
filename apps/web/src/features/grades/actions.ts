"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

type BatchResult = ActionResult & { updated?: number };

function revalidateGrades() {
  revalidatePath("/manage/grades");
  revalidatePath("/grades");
}

export async function generateQuartersAction(): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/grade-periods/generate-quarters");
  if (error) return fromApiError(error);
  revalidateGrades();
  return { ok: true };
}

export async function updatePeriodAction(
  periodId: string,
  input: { scaleMax: number; pointsPerPresence: number },
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/grade-periods/{periodId}", {
    params: { path: { periodId } },
    body: input,
  });
  if (error) return fromApiError(error);
  revalidateGrades();
  return { ok: true };
}

export async function saveGradeAction(
  periodId: string,
  input: { membershipId: string; involvementPoints: number; comment: string },
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/grade-periods/{periodId}/grades", {
    params: { path: { periodId } },
    body: input,
  });
  if (error) return fromApiError(error);
  revalidateGrades();
  return { ok: true };
}

export async function submitGradesAction(periodId: string, poleId: string): Promise<BatchResult> {
  const { data, error } = await (await api()).POST("/v1/grade-periods/{periodId}/submit", {
    params: { path: { periodId } },
    body: { poleId },
  });
  if (error) return fromApiError(error);
  revalidateGrades();
  return { ok: true, updated: data.updated };
}

export async function boardDecisionAction(
  decision: "validate" | "publish",
  ids: string[],
): Promise<BatchResult> {
  const path = decision === "validate" ? "/v1/grades/validate" : "/v1/grades/publish";
  const { data, error } = await (await api()).POST(path, { body: { ids } });
  if (error) return fromApiError(error);
  revalidateGrades();
  return { ok: true, updated: data.updated };
}
