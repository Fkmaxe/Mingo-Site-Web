"use client";

import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { deleteTaskAction, moveTaskAction } from "./actions";
import { NEXT_STATUS, PREVIOUS_STATUS, TASK_STATUS_LABELS } from "./labels";
import { TaskForm } from "./task-form";
import type { PoleMember, TaskDetail } from "./types";
import { useTaskAction } from "./use-task-action";

/** Status moves for organisers and assignees; edition and deletion for organisers. */
export function TaskHeaderActions({ task, members }: { task: TaskDetail; members: PoleMember[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { error, pending, run } = useTaskAction();
  const previous = PREVIOUS_STATUS[task.status];
  const next = NEXT_STATUS[task.status];

  if (editing) {
    return (
      <TaskForm
        mode="edit"
        task={task}
        members={members}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        {task.canContribute && previous ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => moveTaskAction(task.id, previous))}
          >
            <ArrowLeft aria-hidden />
            {TASK_STATUS_LABELS[previous]}
          </Button>
        ) : null}
        {task.canContribute && next ? (
          <Button disabled={pending} onClick={() => run(() => moveTaskAction(task.id, next))}>
            {TASK_STATUS_LABELS[next]}
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
        {task.canEdit ? (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Modifier
            </Button>
            <ConfirmButton
              confirmLabel="Supprimer la tâche"
              disabled={pending}
              onConfirm={() =>
                run(
                  () => deleteTaskAction(task.id),
                  () => router.push("/tasks"),
                )
              }
            >
              <Trash2 aria-hidden />
              Supprimer
            </ConfirmButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
