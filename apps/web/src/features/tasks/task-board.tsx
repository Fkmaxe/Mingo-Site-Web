"use client";

import { TASK_STATUSES, type TaskStatus } from "@bde/shared";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { formatShortDay } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import { deleteTaskAction, moveTaskAction } from "./actions";
import { NEXT_STATUS, PREVIOUS_STATUS, TASK_STATUS_LABELS } from "./labels";
import type { Task } from "./types";

function TaskCard({
  task,
  pending,
  onMove,
  onDelete,
}: {
  task: Task;
  pending: boolean;
  onMove: (status: TaskStatus) => void;
  onDelete: () => void;
}) {
  const previous = PREVIOUS_STATUS[task.status];
  const next = NEXT_STATUS[task.status];
  const late =
    task.dueOn && task.status !== "done" && task.dueOn < new Date().toISOString().slice(0, 10);
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-tight">{task.title}</span>
        {task.canEdit ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Supprimer « ${task.title} »`}
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
      {task.description ? (
        <p className="whitespace-pre-line text-muted-foreground text-sm">{task.description}</p>
      ) : null}
      <p className="text-muted-foreground text-xs">
        {task.assignee ? task.assignee.user.name : "Non assignée"}
        {task.dueOn ? (
          <span className={cn(late && "font-medium text-destructive")}>
            {" "}
            · avant le {formatShortDay(`${task.dueOn}T12:00:00Z`)}
          </span>
        ) : null}
      </p>
      {task.canMove ? (
        <div className="flex gap-2">
          {previous ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onMove(previous)}>
              <ArrowLeft aria-hidden />
              {TASK_STATUS_LABELS[previous]}
            </Button>
          ) : null}
          {next ? (
            <Button size="sm" disabled={pending} onClick={() => onMove(next)}>
              {TASK_STATUS_LABELS[next]}
              <ArrowRight aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Kanban: one column at a time on phones (tabs), three columns from md up. */
export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TaskStatus>("todo");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.message ?? "Erreur"));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div
        role="tablist"
        aria-label="Statut"
        className="grid grid-cols-3 rounded-lg bg-muted p-1 text-sm md:hidden"
      >
        {TASK_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={tab === status}
            onClick={() => setTab(status)}
            className={cn(
              "min-h-10 rounded-md font-medium",
              tab === status ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {TASK_STATUS_LABELS[status]} ({tasks.filter((t) => t.status === status).length})
          </button>
        ))}
      </div>
      <div className="md:grid md:grid-cols-3 md:gap-4">
        {TASK_STATUSES.map((status) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <section
              key={status}
              className={cn("flex flex-col gap-2", tab !== status && "hidden md:flex")}
            >
              <h3 className="hidden font-medium text-muted-foreground text-sm md:block">
                {TASK_STATUS_LABELS[status]} ({column.length})
              </h3>
              {column.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm">
                  Rien ici.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {column.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      pending={pending}
                      onMove={(to) => run(() => moveTaskAction(task.id, to))}
                      onDelete={() => run(() => deleteTaskAction(task.id))}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
