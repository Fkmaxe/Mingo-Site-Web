import "server-only";
import { api } from "@/lib/api";
import type { DirectoryEntry } from "./types";

export async function listDirectory(): Promise<DirectoryEntry[]> {
  const { data, response } = await (await api()).GET("/v1/members");
  if (!data) throw new Error(`GET /v1/members a échoué (${response.status})`);
  return data;
}
