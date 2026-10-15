import { TASK_STATUSES, type TaskStatus } from "@bde/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { listPoles } from "@/features/events/queries";
import { TASK_STATUS_LABELS } from "@/features/tasks/labels";
import {
  listBoardMembers,
  listManagedTasks,
  listPoleMembers,
  type ManagedTasksQuery,
} from "@/features/tasks/queries";
import { NewTaskForm } from "@/features/tasks/task-form";
import { TaskMeta } from "@/features/tasks/task-meta";
import type { TaskTarget } from "@/features/tasks/types";
import { manageTrail } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Tâches" };

type Search = { board?: string; status?: string; mine?: string; late?: string; q?: string };

/**
 * Every task the bureau and the pole leads follow: the bureau board and all poles. A pole lead
 * sees the other poles without editing them.
 */
export default async function ManageTasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireMe();
  const isBoard = me.permissions.includes("poles:all");
  if (!isBoard && !me.roles.includes("pole_lead")) notFound();
  const params = await searchParams;
  const poles = await listPoles();
  const led = new Set(
    me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole.id] : [])),
  );

  const board =
    params.board === "board" && isBoard ? "board" : poles.find((p) => p.id === params.board)?.id;
  const status = (TASK_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as TaskStatus)
    : undefined;
  const query: ManagedTasksQuery = {
    ...(board ? { board } : {}),
    ...(status ? { status } : {}),
    ...(params.mine === "1" ? { assigneeUserId: me.id } : {}),
    ...(params.late === "1" ? { late: "true" as const } : {}),
    ...(params.q?.trim() ? { q: params.q.trim().slice(0, 100) } : {}),
  };

  // A task is created on the board picked in the filters, if the user manages it.
  const target: TaskTarget | null =
    board === "board"
      ? { kind: "board" }
      : board && me.permissions.includes("tasks:manage") && (isBoard || led.has(board))
        ? { kind: "pole", poleId: board }
        : null;
  const [tasks, members] = await Promise.all([
    listManagedTasks(query),
    target?.kind === "board"
      ? listBoardMembers()
      : target?.kind === "pole"
        ? listPoleMembers(target.poleId)
        : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tâches" breadcrumb={manageTrail()} />
      <form className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2" action="/manage/tasks">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-board">Tableau</Label>
          <NativeSelect id="filter-board" name="board" defaultValue={board ?? ""}>
            <option value="">Tous</option>
            {isBoard ? <option value="board">Bureau</option> : null}
            {poles.map((p) => (
              <option key={p.id} value={p.id}>
                Pôle {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-status">Statut</Label>
          <NativeSelect id="filter-status" name="status" defaultValue={status ?? ""}>
            <option value="">Tous</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="filter-q">Recherche</Label>
          <Input id="filter-q" name="q" type="search" defaultValue={params.q ?? ""} />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="mine"
            value="1"
            defaultChecked={params.mine === "1"}
            className="size-5 accent-primary"
          />
          Assignées à moi
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="late"
            value="1"
            defaultChecked={params.late === "1"}
            className="size-5 accent-primary"
          />
          En retard
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" className="flex-1">
            Filtrer
          </Button>
          <Button asChild variant="outline">
            <Link href="/manage/tasks">Effacer</Link>
          </Button>
        </div>
      </form>

      {target ? (
        <NewTaskForm key={board} target={target} members={members} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Choisis un tableau que tu gères pour y créer une tâche.
        </p>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardDescription>Aucune tâche ne correspond.</CardDescription>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-primary/5 shadow-sm transition-colors hover:bg-accent/40"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-tight">{task.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {TASK_STATUS_LABELS[task.status]}
                  </span>
                </span>
                <TaskMeta task={task} showOrigin />
                {task.canEdit ? null : (
                  <span className="text-muted-foreground text-xs">Lecture seule</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
