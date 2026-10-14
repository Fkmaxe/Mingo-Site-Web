"use server";

import type { CreateTaskData, TaskStatus } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { TaskTarget } from "./types";

export async function createTaskAction(
  target: TaskTarget,
  input: CreateTaskData,
): Promise<ActionResult> {
  const client = await api();
  const { error } =
    target.kind === "pole"
      ? await client.POST("/v1/poles/{poleId}/tasks", {
          params: { path: { poleId: target.poleId } },
          body: input,
        })
      : target.kind === "board"
        ? await client.POST("/v1/board/tasks", { body: input })
        : await client.POST("/v1/me/tasks", {
            // Nobody else is assigned to a personal task.
            body: {
              title: input.title,
              description: input.description,
              status: input.status,
              dueOn: input.dueOn,
            },
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
