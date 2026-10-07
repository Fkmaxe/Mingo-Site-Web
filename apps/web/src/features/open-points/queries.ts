import "server-only";
import { api } from "@/lib/api";
import type { LedgerEntry, MyOpenPoints } from "./types";

export async function getMyOpenPoints(): Promise<MyOpenPoints> {
  const { data, response } = await (await api()).GET("/v1/me/open-points");
  if (!data) throw new Error(`GET /v1/me/open-points a échoué (${response.status})`);
  return data;
}

/** Every pending movement of the current school year (pages of 100). */
export async function listAllPending(): Promise<LedgerEntry[]> {
  const client = await api();
  const all: LedgerEntry[] = [];
  let cursor: string | undefined;
  do {
    const { data, response } = await client.GET("/v1/open-points", {
      params: { query: { status: "pending", limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    if (!data) throw new Error(`GET /v1/open-points a échoué (${response.status})`);
    all.push(...data.items);
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return all;
}
