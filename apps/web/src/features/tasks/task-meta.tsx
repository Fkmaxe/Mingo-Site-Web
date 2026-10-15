import { CheckSquare, MessageSquare, Paperclip } from "lucide-react";
import { formatShortDay, parisToday } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import { assigneeNames, TASK_PRIORITY_LABELS, taskOrigin } from "./labels";
import type { Task } from "./types";

/** Board, priority, assignees, deadline and counts of a task, on its card or list row. */
export function TaskMeta({ task, showOrigin }: { task: Task; showOrigin: boolean }) {
  const late = task.dueOn && task.status !== "done" && task.dueOn < parisToday();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
      {showOrigin ? (
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
          {taskOrigin(task)}
        </span>
      ) : null}
      {task.priority === "normal" ? null : (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            task.priority === "high"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground",
          )}
        >
          Priorité {TASK_PRIORITY_LABELS[task.priority].toLowerCase()}
        </span>
      )}
      {task.scope === "personal" ? null : <span>{assigneeNames(task)}</span>}
      {task.dueOn ? (
        <span className={cn(late && "font-medium text-destructive")}>
          avant le {formatShortDay(`${task.dueOn}T12:00:00Z`)}
        </span>
      ) : null}
      {task.checklist.total > 0 ? (
        <span className="flex items-center gap-1">
          <CheckSquare aria-hidden className="size-3.5" />
          <span className="sr-only">Étapes faites :</span>
          {task.checklist.done}/{task.checklist.total}
        </span>
      ) : null}
      {task.attachmentCount > 0 ? (
        <span className="flex items-center gap-1">
          <Paperclip aria-hidden className="size-3.5" />
          <span className="sr-only">Fichiers :</span>
          {task.attachmentCount}
        </span>
      ) : null}
      {task.commentCount > 0 ? (
        <span className="flex items-center gap-1">
          <MessageSquare aria-hidden className="size-3.5" />
          <span className="sr-only">Messages :</span>
          {task.commentCount}
        </span>
      ) : null}
    </div>
  );
}
