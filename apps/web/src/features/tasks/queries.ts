import "server-only";
import { api } from "@/lib/api";
import type { PoleMember, Task } from "./types";

export async function listMyTasks(): Promise<Task[]> {
  const { data, response } = await (await api()).GET("/v1/me/tasks");
  if (!data) throw new Error(`GET /v1/me/tasks a échoué (${response.status})`);
  return data;
}

export async function listPoleTasks(poleId: string): Promise<Task[]> {
  const { data, response } = await (await api()).GET("/v1/poles/{poleId}/tasks", {
    params: { path: { poleId } },
  });
  if (!data) throw new Error(`GET tasks a échoué (${response.status})`);
  return data;
}

export async function listPoleMembers(poleId: string): Promise<PoleMember[]> {
  const { data, response } = await (await api()).GET("/v1/poles/{poleId}/members", {
    params: { path: { poleId } },
  });
  if (!data) throw new Error(`GET members a échoué (${response.status})`);
  return data;
}
