"use client";

import { formatAnswer } from "@bde/shared";
import { ExternalLink, FileText } from "lucide-react";
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

/**
 * Review card: wishes, answers to the questions asked when they applied, documents; then
 * interview, accept (in the first wish by default, or another pole) or reject.
 */
export function ApplicationCard({ application, poles }: Props) {
  const router = useRouter();
  const firstWish = application.wishes[0]?.id ?? poles[0]?.id ?? "";
  const [poleId, setPoleId] = useState(firstWish);
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
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
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
        Souhaite : {application.wishes.map((w, i) => `${i + 1}. ${w.name}`).join(" · ") || "—"} ·{" "}
        {formatShortDay(application.createdAt)}
      </p>
      {application.missingDocuments.length > 0 ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
          Dossier incomplet : {application.missingDocuments.join(", ")}
        </p>
      ) : null}
      <dl className="flex flex-col gap-3">
        {application.questions.map((q) => {
          const answer = formatAnswer(application.answers[q.key]);
          return (
            <div key={q.key} className="flex flex-col gap-0.5">
              <dt className="font-medium text-muted-foreground text-xs">{q.label}</dt>
              <dd className="whitespace-pre-line text-sm">{answer || "—"}</dd>
            </div>
          );
        })}
      </dl>
      {application.documents.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {application.documents.map((d) => {
            const label =
              application.documentRequirements.find((r) => r.key === d.key)?.label ?? d.key;
            return (
              <li key={d.key}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-2 text-sm hover:underline"
                >
                  {d.kind === "link" ? (
                    <ExternalLink aria-hidden className="size-4 shrink-0 text-primary" />
                  ) : (
                    <FileText aria-hidden className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="font-medium">{label}</span>
                  <span className="truncate text-muted-foreground">{d.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
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
