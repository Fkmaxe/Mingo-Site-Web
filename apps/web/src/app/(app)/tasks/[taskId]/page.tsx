import type { Metadata } from "next";
import { DisplayTitle } from "@/components/brand";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TASK_STATUS_LABELS } from "@/features/tasks/labels";
import { getTaskOr404, listBoardMembers, listPoleMembers } from "@/features/tasks/queries";
import { TaskChecklist } from "@/features/tasks/task-checklist";
import { TaskComments } from "@/features/tasks/task-comments";
import { TaskFiles } from "@/features/tasks/task-files";
import { TaskHeaderActions } from "@/features/tasks/task-header-actions";
import { TaskMeta } from "@/features/tasks/task-meta";
import type { PoleMember, TaskDetail } from "@/features/tasks/types";
import { HOME, TASKS } from "@/lib/breadcrumbs";
import { formatDateTime } from "@/lib/paris-time";

export const metadata: Metadata = { title: "Tâche" };

const HISTORY_LABELS: Record<string, string> = {
  "task.created": "a créé la tâche",
  "task.updated": "a modifié",
  "task.checklist_added": "a ajouté l'étape",
  "task.checklist_checked": "a coché",
  "task.checklist_unchecked": "a décoché",
  "task.checklist_removed": "a retiré l'étape",
  "task.attachment_added": "a joint",
  "task.attachment_removed": "a retiré le fichier",
  "task.comment_deleted": "a retiré un message",
};

/** Who the organisers can assign: the pole's members, or the bureau. */
async function assignable(task: TaskDetail): Promise<PoleMember[]> {
  if (!task.canEdit) return [];
  if (task.scope === "board") return listBoardMembers();
  if (task.scope === "pole" && task.pole) return listPoleMembers(task.pole.id);
  return [];
}

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const task = await getTaskOr404((await params).taskId);
  const members = await assignable(task);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={[HOME, TASKS]} current={task.title} />
        <p className="text-primary text-sm">{TASK_STATUS_LABELS[task.status]}</p>
        <DisplayTitle className="text-2xl normal-case leading-tight">{task.title}</DisplayTitle>
        <TaskMeta task={task} showOrigin />
      </div>
      <TaskHeaderActions task={task} members={members} />
      {task.description ? <p className="whitespace-pre-line text-sm">{task.description}</p> : null}
      <TaskChecklist task={task} />
      <TaskFiles task={task} />
      <TaskComments task={task} />
      {task.history.length > 0 ? (
        <section aria-labelledby="history-title" className="flex flex-col gap-2">
          <h2 id="history-title" className="font-semibold">
            Historique
          </h2>
          <ol className="flex flex-col gap-2 border-l pl-4 text-sm">
            {task.history.map((h) => (
              <li key={h.id} className="flex flex-col">
                <span>
                  <span className="font-medium">{h.actor?.name ?? "Quelqu'un"}</span>{" "}
                  {HISTORY_LABELS[h.action] ?? h.action}
                  {h.detail ? ` : ${h.detail}` : ""}
                </span>
                <span className="text-muted-foreground text-xs first-letter:uppercase">
                  {formatDateTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
