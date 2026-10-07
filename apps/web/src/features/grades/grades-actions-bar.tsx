"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { boardDecisionAction, generateQuartersAction, submitGradesAction } from "./actions";

export function GenerateQuartersButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await generateQuartersAction();
            setError(result.ok ? null : result.message);
          })
        }
      >
        Créer les 3 trimestres de l'année
      </Button>
    </div>
  );
}

type Props = {
  periodId: string;
  /** Poles the user leads, with their number of drafts. */
  submittable: { poleId: string; poleName: string; drafts: number }[];
  submittedIds: string[];
  validatedIds: string[];
  isBoard: boolean;
};

/** Lead: submit the pole's drafts. Board: validate submitted grades, publish validated ones. */
export function GradesActionsBar({
  periodId,
  submittable,
  submittedIds,
  validatedIds,
  isBoard,
}: Props) {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (
    action: () => Promise<{ ok: boolean; message?: string; updated?: number }>,
    done: string,
  ) =>
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { tone: "success", text: `${result.updated ?? 0} ${done}` }
          : { tone: "error", text: result.message ?? "Erreur" },
      );
    });

  return (
    <div className="flex flex-col gap-2">
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      {submittable
        .filter((p) => p.drafts > 0)
        .map((p) => (
          <Button
            key={p.poleId}
            disabled={pending}
            onClick={() =>
              run(() => submitGradesAction(periodId, p.poleId), "note(s) soumise(s) au bureau.")
            }
          >
            Soumettre les notes du pôle {p.poleName} ({p.drafts})
          </Button>
        ))}
      {isBoard && submittedIds.length > 0 ? (
        <Button
          disabled={pending}
          onClick={() =>
            run(() => boardDecisionAction("validate", submittedIds), "note(s) validée(s).")
          }
        >
          Valider les notes soumises ({submittedIds.length})
        </Button>
      ) : null}
      {isBoard && validatedIds.length > 0 ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => boardDecisionAction("publish", validatedIds), "note(s) publiée(s).")
          }
        >
          Publier les notes validées ({validatedIds.length})
        </Button>
      ) : null}
    </div>
  );
}
