import "server-only";
import { api } from "@/lib/api";
import type { AdminUser, AuditEntry, SchoolYear } from "./types";

export type UserScope = "all" | "roles" | "unverified";

export async function listAdminUsers(
  q: string | undefined,
  scope: UserScope,
): Promise<{ items: AdminUser[]; total: number }> {
  const { data, response } = await (await api()).GET("/v1/admin/users", {
    params: { query: { scope, ...(q ? { q } : {}) } },
  });
  if (!data) throw new Error(`GET /v1/admin/users a échoué (${response.status})`);
  return data;
}

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const { data, response } = await (await api()).GET("/v1/admin/school-years");
  if (!data) throw new Error(`GET /v1/admin/school-years a échoué (${response.status})`);
  return data;
}

export async function listAudit(cursor: string | undefined) {
  const { data, response } = await (await api()).GET("/v1/admin/audit", {
    params: { query: { limit: 50, ...(cursor ? { cursor } : {}) } },
  });
  if (!data) throw new Error(`GET /v1/admin/audit a échoué (${response.status})`);
  return data as { items: AuditEntry[]; nextCursor: string | null };
}
