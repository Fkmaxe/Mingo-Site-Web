"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/paris-time";
import { addCommentAction, deleteCommentAction } from "./actions";
import type { TaskDetail } from "./types";
import { useTaskAction } from "./use-task-action";

/** Messages of the task: written by organisers and assignees. */
export function TaskComments({ task }: { task: TaskDetail }) {
  const [body, setBody] = useState("");
  const { error, pending, run } = useTaskAction();

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-2">
      <h2 id="comments-title" className="font-semibold">
        Messages {task.comments.length > 0 ? `(${task.comments.length})` : ""}
      </h2>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {task.comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Pas encore de message.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {task.comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs">
                  <span className="font-medium">{c.author?.name ?? "Ancien membre"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · <span className="first-letter:uppercase">{formatDateTime(c.createdAt)}</span>
                  </span>
                </p>
                {c.canDelete ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="-mt-2 -mr-2"
                    aria-label="Retirer ce message"
                    disabled={pending}
                    onClick={() => run(() => deleteCommentAction(task.id, c.id))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {task.canContribute ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            run(
              () => addCommentAction(task.id, body),
              () => setBody(""),
            );
          }}
        >
          <label htmlFor="comment-new" className="sr-only">
            Nouveau message
          </label>
          <Textarea
            id="comment-new"
            rows={3}
            placeholder="Écrire un message"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" className="self-end" disabled={pending || !body.trim()}>
            Envoyer
          </Button>
        </form>
      ) : null}
    </section>
  );
}
