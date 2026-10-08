"use client";

import { ExternalLink, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { formatShortDay } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import { reverseTransactionAction } from "./actions";
import type { Transaction } from "./types";

export function TransactionList({
  transactions,
  canManage,
}: {
  transactions: Transaction[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        Aucune écriture.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <ul className="flex flex-col divide-y rounded-xl border">
        {transactions.map((t) => {
          const cancelled = t.reversedById !== null;
          return (
            <li key={t.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn("font-medium", cancelled && "text-muted-foreground line-through")}
                >
                  {t.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    t.amountCents > 0 ? "text-success" : "text-foreground",
                    cancelled && "text-muted-foreground line-through",
                  )}
                >
                  {t.amountCents > 0 ? "+" : ""}
                  {formatCents(t.amountCents)}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">
                {formatShortDay(`${t.occurredOn}T12:00:00Z`)}
                {t.event ? ` · ${t.event.title}` : ""}
                {t.createdBy ? ` · ${t.createdBy}` : ""}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {t.receiptUrl ? (
                  <a
                    href={t.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary text-xs underline-offset-4 hover:underline"
                  >
                    Justificatif
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : t.amountCents < 0 && !t.reversalOfId ? (
                  <span className="text-warning text-xs">Sans justificatif</span>
                ) : null}
                {canManage && !cancelled && !t.reversalOfId ? (
                  confirming === t.id ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await reverseTransactionAction(t.id);
                            setError(result.ok ? null : result.message);
                            setConfirming(null);
                            router.refresh();
                          })
                        }
                      >
                        Confirmer l'annulation
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                        Retour
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(t.id)}>
                      <Undo2 aria-hidden />
                      Annuler l'écriture
                    </Button>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
