import type { TaskStatus } from "@bde/shared";
import type { Task } from "./types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Fait",
};

export const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: "doing",
  doing: "done",
  done: null,
};

export const PREVIOUS_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: null,
  doing: "todo",
  done: "doing",
};

/** The board a task belongs to, as shown on its card in « Mes tâches ». */
export function taskOrigin(task: Pick<Task, "scope" | "pole">): string {
  if (task.scope === "personal") return "Perso";
  if (task.scope === "board") return "Bureau";
  return task.pole ? `Pôle ${task.pole.name}` : "Pôle";
}
