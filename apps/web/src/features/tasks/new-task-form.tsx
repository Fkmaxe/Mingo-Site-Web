"use client";

import { CreateTaskInput } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTaskAction } from "./actions";
import type { PoleMember } from "./types";

const empty = { title: "", description: "", dueOn: "", assignee: "" };

export function NewTaskForm({ poleId, members }: { poleId: string; members: PoleMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="lg" onClick={() => setOpen(true)}>
        Nouvelle tâche
      </Button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateTaskInput.safeParse({
      title: values.title,
      description: values.description,
      dueOn: values.dueOn || null,
      assigneeMembershipId: values.assignee || null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createTaskAction(poleId, parsed.data);
      if (!result.ok) {
        setMessage(result.message);
        setErrors(result.fieldErrors);
        return;
      }
      setValues(empty);
      setOpen(false);
      router.refresh();
    });
  };

  const set =
    (key: keyof typeof empty) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border p-3">
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      <FormField
        id="task-title"
        label="Titre"
        value={values.title}
        onChange={set("title")}
        error={errors.title}
      />
      <FieldShell id="task-description" label="Description" error={errors.description}>
        {(aria) => (
          <Textarea {...aria} rows={3} value={values.description} onChange={set("description")} />
        )}
      </FieldShell>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="task-due"
          label="À faire avant le"
          type="date"
          value={values.dueOn}
          onChange={set("dueOn")}
          error={errors.dueOn}
        />
        <FieldShell id="task-assignee" label="Assignée à" error={errors.assigneeMembershipId}>
          {(aria) => (
            <NativeSelect {...aria} value={values.assignee} onChange={set("assignee")}>
              <option value="">Personne</option>
              {members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.user.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>
          Créer
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
