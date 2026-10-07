"use client";

import { CreateApplicationInput } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyAction } from "./actions";

export function ApplyForm({ poles }: { poles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [values, setValues] = useState({ wishedPoleId: "", motivation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateApplicationInput.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await applyAction(parsed.data);
      if (!result.ok) {
        setMessage(result.message);
        setErrors(result.fieldErrors);
        return;
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
      <FieldShell id="wishedPoleId" label="Le pôle qui te tente" error={errors.wishedPoleId}>
        {(aria) => (
          <NativeSelect
            {...aria}
            value={values.wishedPoleId}
            onChange={(e) => setValues((v) => ({ ...v, wishedPoleId: e.target.value }))}
          >
            <option value="">Choisir…</option>
            {poles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>
      <FieldShell
        id="motivation"
        label="Pourquoi veux-tu rejoindre le BDE ?"
        hint="Ce que tu aimerais faire, tes disponibilités…"
        error={errors.motivation}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={6}
            value={values.motivation}
            onChange={(e) => setValues((v) => ({ ...v, motivation: e.target.value }))}
          />
        )}
      </FieldShell>
      <Button type="submit" size="lg" disabled={pending}>
        Envoyer ma candidature
      </Button>
    </form>
  );
}
