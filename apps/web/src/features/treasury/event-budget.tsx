import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BudgetCell } from "./budget-cell";
import type { EventBudget } from "./types";

/** Planned budget of an event (set by the treasurer) against its treasury entries. */
export function EventBudgetCard({
  eventId,
  budget,
  canManage,
}: {
  eventId: string;
  budget: EventBudget;
  canManage: boolean;
}) {
  const spent = -budget.expenseCents;
  const over = budget.budgetCents !== null && spent > budget.budgetCents;
  return (
    <Card className="gap-3 p-4">
      <div className="grid grid-cols-3 gap-2 text-sm">
        {(
          [
            ["Dépenses", spent],
            ["Recettes", budget.incomeCents],
            ["Solde", budget.balanceCents],
          ] as const
        ).map(([label, cents]) => (
          <div key={label} className="flex flex-col">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                label === "Solde" && cents < 0 && "text-destructive",
              )}
            >
              {formatCents(cents)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BudgetCell eventId={eventId} budgetCents={budget.budgetCents} canManage={canManage} />
        {over ? <span className="font-medium text-destructive text-xs">Budget dépassé</span> : null}
      </div>
      <Link
        href="/manage/treasury"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        Voir la trésorerie
      </Link>
    </Card>
  );
}
