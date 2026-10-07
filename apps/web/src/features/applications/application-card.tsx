"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { formatShortDay } from "@/lib/paris-time";
import { decideApplicationAction } from "./actions";
import { APPLICATION_STATUS_LABELS } from "./labels";
import type { Application } from "./types";

type Props = { application: Application; poles: { id: string; name: string }[] };

/** Review card: interview, accept (in the wished pole or another one) or reject. */
export function ApplicationCard({ application, poles }: Props) {
  const router = useRouter();
  const [poleId, setPoleId] = useState(application.wishedPole.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = application.status === "new" || application.status === "interview";

  const run = (decision: Parameters<typeof decideApplicationAction>[1]) =>
    startTransition(async () => {
      const result = await decideApplicationAction(application.id, decision);
      setError(result.ok ? null : result.message);
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-semibold">{application.user.name}</span>
          <span className="break-all text-muted-foreground text-xs">
            {application.user.promo ? `${application.user.promo} · ` : ""}
            {application.user.email}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground text-xs">
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>
      <p className="text-primary text-sm">
        Souhaite : pôle {application.wishedPole.name} · {formatShortDay(application.createdAt)}
      </p>
      <p className="whitespace-pre-line text-sm">{application.motivation}</p>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {open ? (
        <div className="flex flex-col gap-2">
          {poles.length > 1 ? (
            <NativeSelect
              aria-label="Pôle d'affectation"
              value={poleId}
              onChange={(e) => setPoleId(e.target.value)}
            >
              {poles.map((p) => (
                <option key={p.id} value={p.id}>
                  Affecter au pôle {p.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => run({ kind: "accept", poleId })}>
              Accepter
            </Button>
            {application.status === "new" ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run({ kind: "interview" })}
              >
                Entretien
              </Button>
            ) : null}
            <Button variant="ghost" disabled={pending} onClick={() => run({ kind: "rejected" })}>
              Refuser
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
