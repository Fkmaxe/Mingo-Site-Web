import { TREASURY_KINDS, type TreasuryKind } from "@bde/shared";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { DownloadLink } from "@/components/download-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSummary, listTransactions } from "@/features/treasury/queries";
import { kindLabel, TransactionList } from "@/features/treasury/transaction-list";
import { manageTrail } from "@/lib/breadcrumbs";
import { formatCents } from "@/lib/money";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trésorerie" };

const FILTERS: [TreasuryKind | "all", string][] = [
  ["all", "Tout"],
  ...TREASURY_KINDS.map((k): [TreasuryKind, string] => [
    k,
    k === "other" ? "Autre" : kindLabel({ kind: k, otherLabel: null }),
  ]),
];

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const [me, params] = await Promise.all([requireMe(), searchParams]);
  if (!me.permissions.includes("budget:read")) notFound();
  const canManage = me.permissions.includes("budget:manage");
  const q = params.q?.trim() || undefined;
  const kind = TREASURY_KINDS.find((k) => k === params.type);
  const [summary, transactions] = await Promise.all([getSummary(), listTransactions({ q, kind })]);
  const link = (type: string) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (type !== "all") next.set("type", type);
    const s = next.toString();
    return s ? `/manage/treasury?${s}` : "/manage/treasury";
  };

  return (
    // Bottom padding: the floating "Ajouter" button never hides the last entry.
    <div className={cn("flex flex-col gap-5", canManage && "pb-16")}>
      <PageHeader
        title="Trésorerie"
        description={`Année ${summary.schoolYear}`}
        breadcrumb={manageTrail()}
        action={<DownloadLink href="/manage/treasury/export">CSV</DownloadLink>}
      />

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

      <form action="/manage/treasury" className="flex gap-2">
        {kind ? <input type="hidden" name="type" value={kind} /> : null}
        <label htmlFor="treasury-search" className="sr-only">
          Rechercher une écriture
        </label>
        <Input
          id="treasury-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Contrepartie, initiateur ou commentaire"
          autoComplete="off"
        />
        <Button type="submit" size="icon" aria-label="Rechercher">
          <Search aria-hidden />
        </Button>
      </form>

      <nav aria-label="Type" className="flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => {
          const active = (kind ?? "all") === value;
          return (
            <Link
              key={value}
              href={link(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-full border px-3 font-semibold text-sm",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <TransactionList
        transactions={transactions}
        empty={
          q || kind
            ? "Aucune écriture ne correspond."
            : "Aucune écriture cette année : ajoute la première."
        }
      />

      {canManage ? (
        <Button
          asChild
          size="lg"
          className="fixed right-4 bottom-24 z-30 shadow-lg md:right-8 md:bottom-8"
        >
          <Link href="/manage/treasury/new">
            <Plus aria-hidden />
            Ajouter
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
