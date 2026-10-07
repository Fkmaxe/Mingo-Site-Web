"use server";

import type { CreateTaskData, TaskStatus } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

export async function createTaskAction(
  poleId: string,
  input: CreateTaskData,
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/poles/{poleId}/tasks", {
    params: { path: { poleId } },
    body: input,
  });
  if (error) return fromApiError(error);
  revalidatePath("/tasks");
  return { ok: true };
}

export async function moveTaskAction(taskId: string, status: TaskStatus): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/tasks/{taskId}", {
    params: { path: { taskId } },
    body: { status },
  });
  if (error) return fromApiError(error);
  revalidatePath("/tasks");
  return { ok: true };
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/tasks/{taskId}", {
    params: { path: { taskId } },
  });
  if (error) return fromApiError(error);
  revalidatePath("/tasks");
  return { ok: true };
}
