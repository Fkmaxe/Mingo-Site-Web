import "server-only";
import type { ApplicationStatus } from "@bde/shared";
import { api } from "@/lib/api";
import type { Application } from "./types";

export async function getMyApplication(): Promise<Application | null> {
  const { data, response } = await (await api()).GET("/v1/me/application");
  if (!response.ok) throw new Error(`GET /v1/me/application a échoué (${response.status})`);
  return data ?? null;
}

export async function listApplications(
  status: ApplicationStatus | undefined,
): Promise<Application[]> {
  const { data, response } = await (await api()).GET("/v1/applications", {
    params: { query: status ? { status } : {} },
  });
  if (!data) throw new Error(`GET /v1/applications a échoué (${response.status})`);
  return data;
}
