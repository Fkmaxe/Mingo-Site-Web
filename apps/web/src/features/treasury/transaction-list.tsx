import { TREASURY_KIND_LABELS } from "@bde/shared";
import { Paperclip } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatCents } from "@/lib/money";
import { formatShortDay } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import type { Transaction } from "./types";

const day = (date: string) => formatShortDay(`${date}T12:00:00Z`);
const href = (t: Transaction) => `/manage/treasury/${t.id}`;

/** « Débit (sortie) », « Crédit (entrée) », or the name given to an « other » entry. */
export function kindLabel(t: Pick<Transaction, "kind" | "otherLabel">) {
  return t.kind === "other" ? (t.otherLabel ?? "Autre") : TREASURY_KIND_LABELS[t.kind];
}

export function Amount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        cents < 0 ? "text-destructive" : "text-success",
        className,
      )}
    >
      {cents > 0 ? "+" : ""}
      {formatCents(cents)}
    </span>
  );
}

function Status({ t }: { t: Transaction }) {
  if (t.reversedById) {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Annulée</span>;
  }
  if (t.reversalOfId) {
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Annulation</span>;
  }
  return null;
}

function Receipts({ t }: { t: Transaction }) {
  const count = t.attachmentCount + (t.receiptUrl ? 1 : 0);
  if (count === 0) {
    return t.amountCents < 0 && !t.reversalOfId ? (
      <span className="text-destructive text-xs">Aucun</span>
    ) : (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      <Paperclip aria-hidden className="size-3.5" />
      {count}
      <span className="sr-only">justificatif{count > 1 ? "s" : ""}</span>
    </span>
  );
}

/**
 * The entries of the year: cards on a phone, a table from md up. Each one opens its page
 * (details and receipts).
 */
export function TransactionList({
  transactions,
  empty,
}: {
  transactions: Transaction[];
  empty: string;
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {empty}
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {transactions.map((t) => (
          <li key={t.id}>
            <Link
              href={href(t)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-primary/5 shadow-sm"
            >
              {t.initiator ? (
                <Avatar name={t.initiator.name} url={t.initiator.avatarUrl} size={36} />
              ) : (
                <span className="size-9 shrink-0 rounded-full bg-muted" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{t.counterparty}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                  {day(t.occurredOn)} · {kindLabel(t)}
                  <Receipts t={t} />
                  <Status t={t} />
                </span>
              </span>
              <Amount cents={t.amountCents} className="shrink-0 text-sm" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Contrepartie
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Initiateur
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Montant
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Type
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Justificatifs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((t) => (
              <tr key={t.id} className="relative hover:bg-muted/40">
                <td className="max-w-48 px-3 py-2">
                  {/* The link covers the whole row. */}
                  <Link
                    href={href(t)}
                    className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {t.counterparty}
                  </Link>
                  <Status t={t} />
                </td>
                <td className="px-3 py-2">
                  {t.initiator ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={t.initiator.name} url={t.initiator.avatarUrl} size={24} />
                      <span className="truncate">{t.initiator.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Amount cents={t.amountCents} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {day(t.occurredOn)}
                </td>
                <td className="px-3 py-2">{kindLabel(t)}</td>
                <td className="px-3 py-2">
                  <Receipts t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
