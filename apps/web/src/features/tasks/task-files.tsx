"use client";

import { DOCUMENT_FILE_MAX_BYTES, TASK_FILES_PER_TASK } from "@bde/shared";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { fileSizeLabel } from "@/lib/file-size";
import { removeTaskFileAction, uploadTaskFileAction } from "./actions";
import type { TaskAttachment, TaskDetail } from "./types";
import { useTaskAction } from "./use-task-action";

const ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";
const isImage = (a: TaskAttachment) => a.contentType.startsWith("image/");
const opensInPage = (a: TaskAttachment) => isImage(a) || a.contentType === "application/pdf";

/** Files of the task: joined by organisers and assignees; photos shown as thumbnails. */
export function TaskFiles({ task }: { task: TaskDetail }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { error, pending, run } = useTaskAction();
  const room = TASK_FILES_PER_TASK - task.attachments.length;

  const send = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = [...files].slice(0, room);
    const tooBig = chosen.filter((f) => f.size > DOCUMENT_FILE_MAX_BYTES);
    if (tooBig.length > 0) {
      setUploadError(`Trop lourd (10 Mo au plus) : ${tooBig.map((f) => f.name).join(", ")}`);
      return;
    }
    setUploadError(null);
    run(async () => {
      // One request per file: a server action body stays under its size limit.
      for (const file of chosen) {
        const form = new FormData();
        form.set("file", file);
        form.set("name", file.name);
        const result = await uploadTaskFileAction(task.id, form);
        if (!result.ok) return result;
      }
      return { ok: true };
    });
    if (input.current) input.current.value = "";
  };

  if (task.attachments.length === 0 && !task.canContribute) return null;
  return (
    <section aria-labelledby="files-title" className="flex flex-col gap-2">
      <h2 id="files-title" className="font-semibold">
        Pièces jointes {task.attachments.length > 0 ? `(${task.attachments.length})` : ""}
      </h2>
      {error || uploadError ? (
        <FormAlert tone="error">{error ?? uploadError ?? ""}</FormAlert>
      ) : null}
      {task.attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {task.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-xl border p-2">
              {isImage(a) ? (
                // biome-ignore lint/performance/noImgElement: private file relayed by the web, not optimisable by next/image.
                <img src={a.url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText aria-hidden className="size-6 text-muted-foreground" />
                </span>
              )}
              <a
                href={a.url}
                target={opensInPage(a) ? "_blank" : undefined}
                rel="noreferrer"
                className="flex min-w-0 flex-1 flex-col"
              >
                <span className="truncate font-medium text-sm hover:underline">{a.name}</span>
                <span className="text-muted-foreground text-xs">
                  {fileSizeLabel(a.sizeBytes)}
                  {a.uploadedBy ? ` · ${a.uploadedBy.name}` : ""}
                </span>
              </a>
              {opensInPage(a) ? null : (
                <Download aria-hidden className="size-4 text-muted-foreground" />
              )}
              {a.canDelete ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Retirer « ${a.name} »`}
                  disabled={pending}
                  onClick={() => run(() => removeTaskFileAction(task.id, a.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {task.canContribute && room > 0 ? (
        <>
          <input
            ref={input}
            id="task-files-input"
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => send(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <Paperclip aria-hidden />
            {pending ? "Envoi…" : "Joindre des fichiers"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Photos, PDF, Word, Excel, PowerPoint, texte ou CSV · 10 Mo max · {room} restant
            {room > 1 ? "s" : ""}
          </p>
        </>
      ) : null}
    </section>
  );
}
