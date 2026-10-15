"use server";

import { type CreateTaskData, TASK_FILE_TYPES, type TaskStatus } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { TaskChanges, TaskTarget } from "./types";

/** Boards, Gestion and the task's page show the change. */
function refresh(taskId?: string) {
  revalidatePath("/tasks");
  revalidatePath("/manage/tasks");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

const done = (taskId?: string): ActionResult => {
  refresh(taskId);
  return { ok: true };
};

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
              priority: input.priority,
              dueOn: input.dueOn,
            },
          });
  return error ? fromApiError(error) : done();
}

export async function updateTaskAction(taskId: string, input: TaskChanges): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/tasks/{taskId}", {
    params: { path: { taskId } },
    body: input,
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function moveTaskAction(taskId: string, status: TaskStatus): Promise<ActionResult> {
  return updateTaskAction(taskId, { status });
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/tasks/{taskId}", {
    params: { path: { taskId } },
  });
  return error ? fromApiError(error) : done();
}

export async function addChecklistItemAction(taskId: string, label: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/tasks/{taskId}/checklist", {
    params: { path: { taskId } },
    body: { label },
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function updateChecklistItemAction(
  taskId: string,
  itemId: string,
  input: { label?: string; done?: boolean },
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/tasks/checklist/{itemId}", {
    params: { path: { itemId } },
    body: input,
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function deleteChecklistItemAction(
  taskId: string,
  itemId: string,
): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/tasks/checklist/{itemId}", {
    params: { path: { itemId } },
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function addCommentAction(taskId: string, body: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/tasks/{taskId}/comments", {
    params: { path: { taskId } },
    body: { body },
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function deleteCommentAction(
  taskId: string,
  commentId: string,
): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/tasks/comments/{commentId}", {
    params: { path: { commentId } },
  });
  return error ? fromApiError(error) : done(taskId);
}

/** Office types by extension, for browsers that give no type (or a generic one). */
const TYPE_BY_EXTENSION: Record<string, (typeof TASK_FILE_TYPES)[number]> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain",
  csv: "text/csv",
  pdf: "application/pdf",
};

/** Sends one file (form fields `file` and `name`). The API checks the type from the bytes. */
export async function uploadTaskFileAction(taskId: string, form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  const rawName = form.get("name");
  if (!(file instanceof Blob)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucun fichier.", fieldErrors: {} };
  }
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "fichier";
  const declared = file.type.split(";")[0] ?? "";
  const type = (TASK_FILE_TYPES as readonly string[]).includes(declared)
    ? (declared as (typeof TASK_FILE_TYPES)[number])
    : (TYPE_BY_EXTENSION[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/pdf");
  const { error } = await (await api()).POST("/v1/tasks/{taskId}/attachments", {
    params: { path: { taskId }, query: { name: name.slice(0, 200) } },
    // Raw file bytes, not JSON.
    body: new Uint8Array(await file.arrayBuffer()) as unknown as string,
    bodySerializer: (body) => body as unknown as BodyInit,
    headers: { "content-type": type },
  });
  return error ? fromApiError(error) : done(taskId);
}

export async function removeTaskFileAction(
  taskId: string,
  attachmentId: string,
): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/tasks/attachments/{attachmentId}", {
    params: { path: { attachmentId } },
  });
  return error ? fromApiError(error) : done(taskId);
}
