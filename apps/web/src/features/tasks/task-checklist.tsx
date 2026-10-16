"use client";

import { TASK_CHECKLIST_MAX } from "@bde/shared";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  updateChecklistItemAction,
} from "./actions";
import type { TaskDetail } from "./types";
import { useTaskAction } from "./use-task-action";

/** Steps of the task: ticked by organisers and assignees, added and removed by organisers. */
export function TaskChecklist({ task }: { task: TaskDetail }) {
  const [label, setLabel] = useState("");
  const { error, pending, run } = useTaskAction();
  const items = task.checklistItems;
  const doneCount = items.filter((i) => i.done).length;

  if (items.length === 0 && !task.canEdit) return null;
  return (
    <section aria-labelledby="checklist-title" className="flex flex-col gap-2">
      <h2 id="checklist-title" className="font-semibold">
        Étapes {items.length > 0 ? `(${doneCount}/${items.length})` : ""}
      </h2>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {items.length > 0 ? (
        <ul className="flex flex-col rounded-xl border px-3">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-11 items-center gap-3">
              <label className="flex flex-1 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={item.done}
                  disabled={!task.canContribute || pending}
                  onChange={(e) =>
                    run(() =>
                      updateChecklistItemAction(task.id, item.id, { done: e.target.checked }),
                    )
                  }
                />
                <span className={item.done ? "text-muted-foreground line-through" : undefined}>
                  {item.label}
                </span>
              </label>
              {task.canEdit ? (
                <ConfirmButton
                  size="icon"
                  aria-label={`Retirer l'étape « ${item.label} »`}
                  disabled={pending}
                  confirmLabel="Retirer"
                  onConfirm={() => run(() => deleteChecklistItemAction(task.id, item.id))}
                >
                  <Trash2 aria-hidden />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {task.canEdit && items.length < TASK_CHECKLIST_MAX ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            run(
              () => addChecklistItemAction(task.id, label),
              () => setLabel(""),
            );
          }}
        >
          <label htmlFor="checklist-new" className="sr-only">
            Nouvelle étape
          </label>
          <Input
            id="checklist-new"
            placeholder="Ajouter une étape"
            value={label}
            maxLength={200}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={pending || !label.trim()}>
            <Plus aria-hidden />
            Ajouter
          </Button>
        </form>
      ) : null}
    </section>
  );
}
