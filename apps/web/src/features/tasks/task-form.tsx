"use client";

import { CreateTaskInput, TASK_PRIORITIES, type TaskPriority, UpdateTaskInput } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { createTaskAction, updateTaskAction } from "./actions";
import { TASK_PRIORITY_LABELS } from "./labels";
import type { PoleMember, Task, TaskTarget } from "./types";

type Props = { members: PoleMember[]; onDone: () => void; onCancel: () => void } & (
  | { mode: "create"; target: TaskTarget }
  | { mode: "edit"; task: Task }
);

type Values = {
  title: string;
  description: string;
  priority: TaskPriority;
  noDueDate: boolean;
  dueOn: string;
  assignees: string[];
};

function initialValues(task: Task | null): Values {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "normal",
    noDueDate: task ? task.dueOn === null : false,
    dueOn: task?.dueOn ?? "",
    assignees: task?.assignees.map((a) => a.membershipId) ?? [],
  };
}

const issuesByField = (issues: { path: PropertyKey[]; message: string }[]) =>
  Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

/**
 * A task's title, description, priority, deadline ("Sans délai" for none) and assignees. A
 * personal task has nobody to assign; neither does a task edited without the member list.
 */
export function TaskForm(props: Props) {
  const task = props.mode === "edit" ? props.task : null;
  const personal =
    props.mode === "create" ? props.target.kind === "personal" : task?.scope === "personal";
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(task));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Current assignees stay selectable even if they are no longer in the list.
  const members = [
    ...(task?.assignees.filter(
      (a) => !props.members.some((m) => m.membershipId === a.membershipId),
    ) ?? []),
    ...props.members,
  ];
  const assignable = !personal && (props.mode === "create" || props.members.length > 0);

  const fields = {
    title: values.title,
    description: values.description,
    priority: values.priority,
    dueOn: values.noDueDate ? null : values.dueOn || null,
    ...(assignable ? { assigneeMembershipIds: values.assignees } : {}),
  };

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.message);
        setErrors(result.fieldErrors);
        return;
      }
      props.onDone();
      router.refresh();
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.noDueDate && !values.dueOn) {
      setErrors({ dueOn: "Choisis une date ou coche « Sans délai »" });
      return;
    }
    if (props.mode === "create") {
      const parsed = CreateTaskInput.safeParse(fields);
      if (!parsed.success) return setErrors(issuesByField(parsed.error.issues));
      setErrors({});
      run(() => createTaskAction(props.target, parsed.data));
    } else {
      const parsed = UpdateTaskInput.safeParse(fields);
      if (!parsed.success) return setErrors(issuesByField(parsed.error.issues));
      setErrors({});
      // The API trims and validates again; `fields` only holds the edited keys.
      run(() => updateTaskAction(props.task.id, fields));
    }
  };

  const set =
    (key: "title" | "description" | "dueOn" | "priority") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  const id = (name: string) => `task-${task?.id ?? "new"}-${name}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border p-3">
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      {personal && props.mode === "create" ? (
        <p className="text-muted-foreground text-sm">Une tâche perso n'est visible que par toi.</p>
      ) : null}
      <FormField
        id={id("title")}
        label="Titre"
        value={values.title}
        onChange={set("title")}
        error={errors.title}
      />
      <FieldShell id={id("description")} label="Description" error={errors.description}>
        {(aria) => (
          <Textarea {...aria} rows={4} value={values.description} onChange={set("description")} />
        )}
      </FieldShell>
      <FieldShell id={id("priority")} label="Priorité" error={errors.priority}>
        {(aria) => (
          <NativeSelect {...aria} value={values.priority} onChange={set("priority")}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          {values.noDueDate ? null : (
            <FormField
              id={id("due")}
              label="À faire avant le"
              type="date"
              value={values.dueOn}
              onChange={set("dueOn")}
              error={errors.dueOn}
            />
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={values.noDueDate}
              onChange={(e) => setValues((v) => ({ ...v, noDueDate: e.target.checked }))}
            />
            Sans délai
          </label>
        </div>
        {assignable ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-medium text-sm">Assignée à</legend>
            {members.length === 0 ? (
              <p className="text-muted-foreground text-sm">Personne à assigner.</p>
            ) : (
              <div className="flex max-h-56 flex-col overflow-y-auto rounded-lg border px-3">
                {members.map((m) => (
                  <label key={m.membershipId} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={values.assignees.includes(m.membershipId)}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          assignees: e.target.checked
                            ? [...v.assignees, m.membershipId]
                            : v.assignees.filter((id) => id !== m.membershipId),
                        }))
                      }
                    />
                    {m.user.name}
                  </label>
                ))}
              </div>
            )}
            {errors.assigneeMembershipIds ? (
              <p className="text-destructive text-sm">{errors.assigneeMembershipIds}</p>
            ) : null}
          </fieldset>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>
          {props.mode === "create" ? "Créer" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** New task of a pole board, of the bureau board, or a personal one (nobody to assign). */
export function NewTaskForm({
  target,
  members = [],
}: {
  target: TaskTarget;
  members?: PoleMember[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="lg" onClick={() => setOpen(true)}>
        {target.kind === "personal" ? "Nouvelle tâche perso" : "Nouvelle tâche"}
      </Button>
    );
  }
  return (
    <TaskForm
      mode="create"
      target={target}
      members={members}
      onDone={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  );
}
