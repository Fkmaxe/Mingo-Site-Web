"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/features/admin/use-action";
import { cn } from "@/lib/utils";
import { recordMatchAction } from "./actions";
import type { TournamentMatch } from "./types";

type Side = "a" | "b";

function SideRow({
  match,
  side,
  onPick,
  disabled,
}: {
  match: TournamentMatch;
  side: Side;
  onPick: ((side: Side) => void) | null;
  disabled: boolean;
}) {
  const entrant = match[side];
  const score = side === "a" ? match.scoreA : match.scoreB;
  const won = entrant !== null && match.winnerId === entrant.id;
  const decided = match.winnerId !== null || match.draw;
  // A first-round slot left empty is a bye: the other side goes through.
  const empty = match.phase === "bracket" && match.round === 1 ? "Exempt" : "À venir";
  const content = (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          !entrant && "text-muted-foreground italic",
          decided && !won && "text-muted-foreground",
          won && "font-bold",
        )}
      >
        {entrant?.name ?? empty}
      </span>
      {score !== null ? (
        <span className={cn("font-mono tabular-nums", won && "font-bold")}>{score}</span>
      ) : null}
      {won ? <Check aria-label="Vainqueur" className="size-4 shrink-0 text-primary" /> : null}
    </>
  );
  const className = cn(
    "flex min-h-11 w-full items-center gap-2 px-3 text-sm",
    won && "bg-primary/8",
  );
  if (!onPick || !entrant) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(side)}
      aria-pressed={won}
      aria-label={`${entrant.name} gagne`}
      className={cn(className, "transition-colors hover:bg-accent disabled:opacity-60")}
    >
      {content}
    </button>
  );
}

/**
 * One match. For organisers: tap a name to set the winner (tap again elsewhere to correct),
 * or enter the score; draws in pools only.
 */
export function MatchCard({ match, manage }: { match: TournamentMatch; manage: boolean }) {
  const { run, pending, error } = useAction();
  const [scoring, setScoring] = useState(false);
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [local, setLocal] = useState<string | null>(null);
  const editable = manage && match.editable;
  const decided = match.winnerId !== null || match.draw;

  const save = (result: "a" | "b" | "draw" | null, a: number | null, b: number | null) =>
    run(
      () => recordMatchAction(match.id, { result, scoreA: a, scoreB: b }),
      () => setScoring(false),
    );

  const saveScore = () => {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (scoreA === "" || scoreB === "" || !Number.isInteger(a) || !Number.isInteger(b)) {
      setLocal("Indique les deux scores.");
      return;
    }
    if (a === b && match.phase !== "pool") {
      setLocal("Pas d'égalité en phase finale : il faut un vainqueur.");
      return;
    }
    setLocal(null);
    save(a > b ? "a" : a < b ? "b" : "draw", a, b);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-primary/5 shadow-sm">
      {match.draw ? (
        <p className="bg-muted px-3 py-1 text-center font-semibold text-muted-foreground text-xs">
          Match nul
        </p>
      ) : null}
      <SideRow
        match={match}
        side="a"
        disabled={pending}
        onPick={editable ? (s) => save(s, null, null) : null}
      />
      <div className="h-px bg-border" />
      <SideRow
        match={match}
        side="b"
        disabled={pending}
        onPick={editable ? (s) => save(s, null, null) : null}
      />
      {editable ? (
        <div className="flex flex-col gap-2 border-t bg-muted/40 p-2">
          {error || local ? <FormAlert tone="error">{local ?? error ?? ""}</FormAlert> : null}
          {scoring ? (
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Score de ${match.a?.name ?? "A"}`}
                inputMode="numeric"
                className="h-10 w-16 text-center"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              <span aria-hidden>–</span>
              <Input
                aria-label={`Score de ${match.b?.name ?? "B"}`}
                inputMode="numeric"
                className="h-10 w-16 text-center"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              <Button size="sm" className="ml-auto" disabled={pending} onClick={saveScore}>
                OK
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setScoreA(match.scoreA?.toString() ?? "");
                  setScoreB(match.scoreB?.toString() ?? "");
                  setScoring(true);
                }}
              >
                Score
              </Button>
              {match.phase === "pool" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => save("draw", null, null)}
                >
                  Nul
                </Button>
              ) : null}
              {decided ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-muted-foreground"
                  disabled={pending}
                  onClick={() => save(null, null, null)}
                >
                  Effacer
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
