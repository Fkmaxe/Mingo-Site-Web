"use client";

import { CheckCircle2, CircleAlert, CircleX, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { checkinAction, searchCandidatesAction } from "./actions";
import type { CheckinCandidate, CheckinStats, ScanOutcome } from "./types";

// Camera code and jsQR are only loaded on this screen, client-side.
const QrScanner = dynamic(() => import("./qr-scanner").then((m) => m.QrScanner), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />,
});

const OUTCOME_STYLES = {
  success: { box: "bg-success/15 text-success", Icon: CheckCircle2 },
  warning: { box: "bg-warning/15 text-warning", Icon: CircleAlert },
  error: { box: "bg-destructive/15 text-destructive", Icon: CircleX },
} as const;

function OutcomeBanner({ outcome }: { outcome: ScanOutcome }) {
  const { box, Icon } = OUTCOME_STYLES[outcome.tone];
  return (
    <div role="status" aria-live="assertive" className={cn("flex gap-3 rounded-xl p-4", box)}>
      <Icon aria-hidden className="size-8 shrink-0" />
      <div className="flex flex-col">
        <span className="font-semibold text-lg leading-tight">{outcome.title}</span>
        <span className="text-sm">{outcome.detail}</span>
      </div>
    </div>
  );
}

type Props = { eventId: string; initialStats: CheckinStats };

export function CheckinScreen({ eventId, initialStats }: Props) {
  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [stats, setStats] = useState(initialStats);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CheckinCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const checkin = async (input: { qrToken: string } | { userId: string }) => {
    setBusy(true);
    try {
      const result = await checkinAction(eventId, input);
      setOutcome(result.outcome);
      if (result.stats) setStats(result.stats);
      navigator.vibrate?.(result.outcome.tone === "success" ? 120 : [80, 60, 80]);
    } finally {
      setBusy(false);
    }
  };

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    startSearch(async () => {
      const result = await searchCandidatesAction(eventId, query);
      setCandidates(result.candidates);
      setSearchError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-semibold text-3xl tabular-nums">
        {stats.checkedInCount}
        <span className="font-normal text-base text-muted-foreground">
          {" "}
          / {stats.confirmedCount} entrées
        </span>
      </p>

      <div
        role="tablist"
        aria-label="Mode de pointage"
        className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm"
      >
        {(
          [
            ["scan", "Scanner"],
            ["search", "Recherche"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "min-h-10 rounded-md font-medium",
              mode === value ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {outcome ? <OutcomeBanner outcome={outcome} /> : null}

      {mode === "scan" ? (
        <QrScanner paused={busy} onScan={(code) => void checkin({ qrToken: code })} />
      ) : (
        <div className="flex flex-col gap-3">
          <form onSubmit={search} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="checkin-search">Nom ou email</Label>
              <Input
                id="checkin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>
            <Button type="submit" size="icon" aria-label="Chercher" disabled={searching}>
              <Search aria-hidden />
            </Button>
          </form>
          {searchError ? <p className="text-destructive text-sm">{searchError}</p> : null}
          {candidates && candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun inscrit ne correspond.</p>
          ) : null}
          <ul className="flex flex-col divide-y rounded-xl border">
            {(candidates ?? []).map((c) => (
              <li
                key={c.registrationId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{c.user.name}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {c.user.promo ? `${c.user.promo} · ` : ""}
                    {c.user.email}
                  </span>
                </div>
                {c.checkedInAt ? (
                  <span className="shrink-0 text-muted-foreground text-sm">Entré·e</span>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      await checkin({ userId: c.user.id });
                      setCandidates((list) =>
                        (list ?? []).map((item) =>
                          item.registrationId === c.registrationId
                            ? { ...item, checkedInAt: new Date().toISOString() }
                            : item,
                        ),
                      );
                    }}
                  >
                    Pointer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
