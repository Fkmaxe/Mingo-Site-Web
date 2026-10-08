import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadLink } from "@/components/download-link";
import { Card } from "@/components/ui/card";
import { listEvents } from "@/features/events/queries";
import { BudgetCell } from "@/features/treasury/budget-cell";
import { getSummary, listTransactions } from "@/features/treasury/queries";
import { TransactionForm } from "@/features/treasury/transaction-form";
import { TransactionList } from "@/features/treasury/transaction-list";
import { formatCents } from "@/lib/money";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trésorerie" };

export default async function TreasuryPage() {
  const me = await requireMe();
  if (!me.permissions.includes("budget:read")) notFound();
  const canManage = me.permissions.includes("budget:manage");
  const [summary, transactions, upcoming, past] = await Promise.all([
    getSummary(),
    listTransactions(),
    listEvents({ scope: "upcoming", manageable: true, limit: 50 }),
    listEvents({ scope: "past", manageable: true, limit: 50 }),
  ]);
  const allEvents = [...past.items, ...upcoming.items].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
  const events = allEvents.map((e) => ({ id: e.id, title: e.title }));
  const figures = new Map(summary.events.map((e) => [e.event.id, e]));
  // Every event of the year, with its figures when it has a budget or entries.
  const rows = allEvents.map((e) => ({
    event: e,
    budgetCents: figures.get(e.id)?.budgetCents ?? null,
    incomeCents: figures.get(e.id)?.incomeCents ?? 0,
    expenseCents: figures.get(e.id)?.expenseCents ?? 0,
    balanceCents: figures.get(e.id)?.balanceCents ?? 0,
  }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">Trésorerie {summary.schoolYear}</h1>
        <DownloadLink href="/manage/treasury/export">CSV</DownloadLink>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Recettes", summary.incomeCents],
            ["Dépenses", summary.expenseCents],
            ["Solde", summary.balanceCents],
          ] as const
        ).map(([label, cents]) => (
          <Card key={label} className="gap-1 p-3">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span
              className={cn(
                "font-bold tabular-nums",
                label === "Solde" && cents < 0 && "text-destructive",
              )}
            >
              {formatCents(cents)}
            </span>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Par événement</h2>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun événement cette année.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {rows.map((e) => {
              const over = e.budgetCents !== null && -e.expenseCents > e.budgetCents;
              return (
                <li key={e.event.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/manage/events/${e.event.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.event.title}
                    </Link>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        e.balanceCents < 0 && "text-destructive",
                      )}
                    >
                      {formatCents(e.balanceCents)}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Dépenses {formatCents(-e.expenseCents)} · Recettes {formatCents(e.incomeCents)}
                    {over ? " · budget dépassé" : ""}
                  </span>
                  <BudgetCell
                    eventId={e.event.id}
                    budgetCents={e.budgetCents}
                    canManage={canManage}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {canManage ? (
          <p className="text-muted-foreground text-xs">
            Pour fixer le budget d'un événement sans écriture, saisis-le depuis une première
            écriture ou l'événement apparaîtra ici dès qu'il en aura une.
          </p>
        ) : null}
      </section>

      {canManage ? <TransactionForm events={events} today={today} /> : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Écritures</h2>
        <TransactionList transactions={transactions} canManage={canManage} />
      </section>
    </div>
  );
}
