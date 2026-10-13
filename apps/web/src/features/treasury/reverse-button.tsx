"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { reverseTransactionAction } from "./actions";

/** Cancels an entry with an opposite one (ledger), after a confirmation. */
export function ReverseButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Undo2 aria-hidden />
        Annuler l'écriture
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 p-3">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <p className="text-sm">
        Une écriture inverse, datée d'aujourd'hui, remet le solde à l'état d'avant. Elle reste dans
        l'historique.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await reverseTransactionAction(transactionId);
              if (!result.ok) return setError(result.message);
              router.push(`/manage/treasury/${result.id ?? transactionId}`);
            })
          }
        >
          Confirmer l'annulation
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Garder
        </Button>
      </div>
    </div>
  );
}
