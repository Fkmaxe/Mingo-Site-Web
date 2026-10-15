import "server-only";
import type { TaskStatus } from "@bde/shared";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { PoleMember, Task, TaskDetail } from "./types";

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

export async function listBoardTasks(): Promise<Task[]> {
  const { data, response } = await (await api()).GET("/v1/board/tasks");
  if (!data) throw new Error(`GET /v1/board/tasks a échoué (${response.status})`);
  return data;
}

/** The bureau of the year: who a bureau task can be assigned to. */
export async function listBoardMembers(): Promise<PoleMember[]> {
  const { data, response } = await (await api()).GET("/v1/board/members");
  if (!data) throw new Error(`GET /v1/board/members a échoué (${response.status})`);
  return data;
}

export async function getTaskOr404(taskId: string): Promise<TaskDetail> {
  const { data, response } = await (await api()).GET("/v1/tasks/{taskId}", {
    params: { path: { taskId } },
  });
  if (response.status === 404 || response.status === 400) notFound();
  if (!data) throw new Error(`GET task a échoué (${response.status})`);
  return data;
}

/** Filters of Gestion → Tâches, as in the page's URL. */
export type ManagedTasksQuery = {
  board?: string;
  status?: TaskStatus;
  assigneeUserId?: string;
  late?: "true";
  q?: string;
};

/** Gestion → Tâches: the bureau board and every pole, filtered. */
export async function listManagedTasks(query: ManagedTasksQuery): Promise<Task[]> {
  const { data, response } = await (await api()).GET("/v1/tasks", { params: { query } });
  if (!data) throw new Error(`GET /v1/tasks a échoué (${response.status})`);
  return data;
}
