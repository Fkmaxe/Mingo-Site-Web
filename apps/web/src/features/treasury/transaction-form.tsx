"use client";

import { CreateTransactionInput } from "@bde/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { parseEuros } from "@/lib/money";
import { createTransactionAction } from "./actions";

type Props = { events: { id: string; title: string }[]; today: string };

/** New entry: the amount is typed positive, the kind gives the sign. */
export function TransactionForm({ events, today }: Props) {
  const router = useRouter();
  const empty = {
    kind: "expense",
    amount: "",
    label: "",
    occurredOn: today,
    eventId: "",
    receiptUrl: "",
  };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set =
    (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseEuros(values.amount);
    if (cents === null || cents === 0) {
      setErrors({ amountCents: "Indique un montant positif, 2 décimales au plus" });
      return;
    }
    const parsed = CreateTransactionInput.safeParse({
      label: values.label,
      amountCents: values.kind === "expense" ? -cents : cents,
      occurredOn: values.occurredOn,
      eventId: values.eventId || null,
      receiptUrl: values.receiptUrl.trim() || null,
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createTransactionAction(parsed.data);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        setErrors(result.fieldErrors);
        return;
      }
      setValues(empty);
      setMessage({ tone: "success", text: "Écriture enregistrée." });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-xl border p-3">
      <span className="font-medium text-sm">Nouvelle écriture</span>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="grid grid-cols-2 gap-3">
        <FieldShell id="tx-kind" label="Type">
          {(aria) => (
            <NativeSelect {...aria} value={values.kind} onChange={set("kind")}>
              <option value="expense">Dépense</option>
              <option value="income">Recette</option>
            </NativeSelect>
          )}
        </FieldShell>
        <FormField
          id="tx-amount"
          label="Montant (€)"
          inputMode="decimal"
          placeholder="12,50"
          value={values.amount}
          onChange={set("amount")}
          error={errors.amountCents}
        />
      </div>
      <FormField
        id="tx-label"
        label="Libellé"
        value={values.label}
        onChange={set("label")}
        error={errors.label}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="tx-date"
          label="Date"
          type="date"
          value={values.occurredOn}
          onChange={set("occurredOn")}
          error={errors.occurredOn}
        />
        <FieldShell id="tx-event" label="Événement (facultatif)">
          {(aria) => (
            <NativeSelect {...aria} value={values.eventId} onChange={set("eventId")}>
              <option value="">Aucun</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      </div>
      <FormField
        id="tx-receipt"
        label="Lien du justificatif"
        type="url"
        placeholder="https://drive.google.com/…"
        hint="Facture ou ticket déposé sur le Drive du BDE"
        value={values.receiptUrl}
        onChange={set("receiptUrl")}
        error={errors.receiptUrl}
      />
      <Button type="submit" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}
