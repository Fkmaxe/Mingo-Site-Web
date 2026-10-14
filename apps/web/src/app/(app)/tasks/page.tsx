import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { Card, CardDescription } from "@/components/ui/card";
import { listPoles } from "@/features/events/queries";
import { NewTaskForm } from "@/features/tasks/new-task-form";
import {
  listBoardMembers,
  listBoardTasks,
  listMyTasks,
  listPoleMembers,
  listPoleTasks,
} from "@/features/tasks/queries";
import { TaskBoard } from "@/features/tasks/task-board";
import type { PoleMember, Task, TaskTarget } from "@/features/tasks/types";
import { HOME } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tâches" };

type Tab = { key: string; label: string; href: string };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ pole?: string; scope?: string }>;
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
  const params = await searchParams;
  const pole = poles.find((p) => p.id === params.pole);
  // The bureau board is the bureau's only.
  const board = isBoard && !pole && params.scope === "board";

  const ledPoleIds = new Set(
    me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole.id] : [])),
  );
  const target: TaskTarget | null = pole
    ? me.permissions.includes("tasks:manage") && (isBoard || ledPoleIds.has(pole.id))
      ? { kind: "pole", poleId: pole.id }
      : null
    : board
      ? { kind: "board" }
      : { kind: "personal" };

  let tasks: Task[];
  let members: PoleMember[] = [];
  if (pole) {
    [tasks, members] = await Promise.all([
      listPoleTasks(pole.id),
      target ? listPoleMembers(pole.id) : Promise.resolve([]),
    ]);
  } else if (board) {
    [tasks, members] = await Promise.all([listBoardTasks(), listBoardMembers()]);
  } else {
    tasks = await listMyTasks();
  }

  const tabs: Tab[] = [
    { key: "mine", label: "Mes tâches", href: "/tasks" },
    ...(isBoard ? [{ key: "board", label: "Bureau", href: "/tasks?scope=board" }] : []),
    ...poles.map((p) => ({ key: p.id, label: `Pôle ${p.name}`, href: `/tasks?pole=${p.id}` })),
  ];
  const active = pole?.id ?? (board ? "board" : "mine");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tâches" breadcrumb={[HOME]} />
      <nav
        aria-label="Tableau"
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center rounded-md px-3 font-medium",
              active === tab.key ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {active === "mine" ? (
        <p className="text-muted-foreground text-sm">
          Les tâches qui te sont assignées et tes tâches perso, visibles par toi seul·e.
        </p>
      ) : null}
      {target ? <NewTaskForm key={active} target={target} members={members} /> : null}
      <TaskBoard tasks={tasks} showOrigin={active === "mine"} />
    </div>
  );
}
