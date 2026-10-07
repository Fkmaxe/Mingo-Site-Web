"use client";

import { useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { updatePeriodAction } from "./actions";
import type { GradePeriod } from "./types";

/** Board: scale and default points per presence of a period. */
export function PeriodSettings({ period }: { period: GradePeriod }) {
  const [scale, setScale] = useState(String(period.scaleMax));
  const [points, setPoints] = useState(String(period.pointsPerPresence));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updatePeriodAction(period.id, {
        scaleMax: Number(scale),
        pointsPerPresence: Number(points.replace(",", ".")),
      });
      setMessage(
        result.ok
          ? { tone: "success", text: "Réglages enregistrés." }
          : { tone: "error", text: result.message },
      );
    });
  };

  return (
    <details className="rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer content-center font-medium text-sm">
        Réglages de la période
      </summary>
      <form onSubmit={save} noValidate className="mt-3 flex flex-col gap-3">
        {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            id="scaleMax"
            label="Barème (note maximale)"
            type="number"
            inputMode="numeric"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
          <FormField
            id="pointsPerPresence"
            label="Points par présence"
            inputMode="decimal"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Enregistrer les réglages
        </Button>
      </form>
    </details>
  );
}
