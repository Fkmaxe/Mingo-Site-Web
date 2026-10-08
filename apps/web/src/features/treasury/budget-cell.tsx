"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, parseEuros } from "@/lib/money";
import { setBudgetAction } from "./actions";

/** Planned budget of an event, editable by the treasurer. */
export function BudgetCell({
  eventId,
  budgetCents,
  canManage,
}: {
  eventId: string;
  budgetCents: number | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    budgetCents === null ? "" : String(budgetCents / 100).replace(".", ","),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = budgetCents === null ? "Pas de budget" : `Budget ${formatCents(budgetCents)}`;

  if (!canManage) return <span className="text-muted-foreground text-xs">{label}</span>;
  if (!editing) {
    return (
      <button
        type="button"
        className="min-h-11 text-left text-primary text-xs underline-offset-4 hover:underline"
        onClick={() => setEditing(true)}
      >
        {label}
      </button>
    );
  }
  const save = () => {
    const empty = value.trim() === "";
    const cents = empty ? null : parseEuros(value);
    if (!empty && cents === null) {
      setError("Montant invalide");
      return;
    }
    startTransition(async () => {
      const result = await setBudgetAction(eventId, cents);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };
  return (
    <span className="flex items-center gap-2">
      <Input
        aria-label="Budget prévu (€)"
        inputMode="decimal"
        className="h-9 w-28"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button size="sm" disabled={pending} onClick={save}>
        OK
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </span>
  );
}
