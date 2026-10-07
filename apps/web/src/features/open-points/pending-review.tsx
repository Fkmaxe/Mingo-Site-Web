"use client";

import { useMemo, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { decideAction } from "./actions";
import { formatPoints } from "./labels";
import type { LedgerEntry } from "./types";

/** Pending movements grouped by event, with batch validation or rejection. */
export function PendingReview({ entries }: { entries: LedgerEntry[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const byEvent = new Map<string, { title: string; entries: LedgerEntry[] }>();
    for (const entry of entries) {
      const key = entry.event?.id ?? "manual";
      const group = byEvent.get(key) ?? { title: entry.event?.title ?? "Autres", entries: [] };
      group.entries.push(entry);
      byEvent.set(key, group);
    }
    return [...byEvent.entries()];
  }, [entries]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  const decide = (decision: "validate" | "reject") =>
    startTransition(async () => {
      const result = await decideAction(decision, [...selected]);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({
        tone: "success",
        text: `${result.updated} mouvement(s) ${decision === "validate" ? "validé(s)" : "refusé(s)"}.`,
      });
      setSelected(new Set());
    });

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Rien à valider.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      {groups.map(([key, group]) => {
        const ids = group.entries.map((e) => e.id);
        const allOn = ids.every((id) => selected.has(id));
        return (
          <section key={key} className="flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={allOn}
                onChange={(e) => toggle(ids, e.target.checked)}
              />
              {group.title} ({group.entries.length})
            </label>
            <ul className="flex flex-col divide-y rounded-xl border">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <label className="flex min-h-11 items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={selected.has(entry.id)}
                      onChange={(e) => toggle([entry.id], e.target.checked)}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{entry.user.name}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {entry.user.promo ? `${entry.user.promo} · ` : ""}
                        {entry.user.email}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatPoints(entry.delta, true)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button
            size="lg"
            className="flex-1"
            disabled={pending || selected.size === 0}
            onClick={() => decide("validate")}
          >
            Valider ({selected.size})
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={pending || selected.size === 0}
            onClick={() => decide("reject")}
          >
            Refuser
          </Button>
        </div>
      </div>
    </div>
  );
}
