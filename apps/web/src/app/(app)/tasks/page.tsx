import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription } from "@/components/ui/card";
import { listPoles } from "@/features/events/queries";
import { NewTaskForm } from "@/features/tasks/new-task-form";
import { listMyTasks, listPoleMembers, listPoleTasks } from "@/features/tasks/queries";
import { TaskBoard } from "@/features/tasks/task-board";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tâches" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ pole?: string }>;
}) {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <Card>
        <CardDescription>Les tâches concernent les membres du BDE.</CardDescription>
      </Card>
    );
  }
  const isBoard = me.permissions.includes("poles:all");
  const myPoles = me.memberships.flatMap((m) => (m.pole ? [m.pole] : []));
  const poles = isBoard ? await listPoles() : myPoles;
  const requested = (await searchParams).pole;
  const pole = poles.find((p) => p.id === requested);

  const ledPoleIds = new Set(
    me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole.id] : [])),
  );
  const canCreate =
    pole !== undefined &&
    me.permissions.includes("tasks:manage") &&
    (isBoard || ledPoleIds.has(pole.id));
  const [tasks, members] = await Promise.all([
    pole ? listPoleTasks(pole.id) : listMyTasks(),
    canCreate && pole ? listPoleMembers(pole.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-2xl">Tâches</h1>
      <nav
        aria-label="Tableau"
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm"
      >
        {[{ id: "", name: "Mes tâches" }, ...poles].map((p) => {
          const active = (pole?.id ?? "") === p.id;
          return (
            <Link
              key={p.id || "mine"}
              href={p.id ? `/tasks?pole=${p.id}` : "/tasks"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center rounded-md px-3 font-medium",
                active ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {p.id ? `Pôle ${p.name}` : p.name}
            </Link>
          );
        })}
      </nav>
      {canCreate && pole ? <NewTaskForm key={pole.id} poleId={pole.id} members={members} /> : null}
      <TaskBoard tasks={tasks} />
    </div>
  );
}
