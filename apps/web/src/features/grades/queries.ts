import "server-only";
import { api } from "@/lib/api";
import type { GradePeriod, MemberGrade, MyGrades } from "./types";

export async function listPeriods(): Promise<GradePeriod[]> {
  const { data, response } = await (await api()).GET("/v1/grade-periods");
  if (!data) throw new Error(`GET /v1/grade-periods a échoué (${response.status})`);
  return data;
}

export async function listGrades(periodId: string): Promise<MemberGrade[]> {
  const { data, response } = await (await api()).GET("/v1/grade-periods/{periodId}/grades", {
    params: { path: { periodId }, query: {} },
  });
  if (!data) throw new Error(`GET grades a échoué (${response.status})`);
  return data;
}

export async function getMyGrades(): Promise<MyGrades> {
  const { data, response } = await (await api()).GET("/v1/me/grades");
  if (!data) throw new Error(`GET /v1/me/grades a échoué (${response.status})`);
  return data;
}
