"use client";

import { Check, Copy, Crown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Team } from "./types";

type Props = { team: Team; minSize: number; maxSize: number };

/** The user's team: the code to pass on to teammates, and who is in. */
export function TeamCard({ team, minSize, maxSize }: Props) {
  const [copied, setCopied] = useState(false);
  const confirmed = team.members.filter((m) => m.status === "confirmed").length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (insecure context): the code stays readable on screen.
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-muted-foreground text-xs">Ton équipe</span>
          <span className="truncate font-semibold">{team.name}</span>
        </div>
        <span
          className={
            team.complete
              ? "shrink-0 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success text-xs"
              : "shrink-0 rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning text-xs"
          }
        >
          {team.complete ? "Équipe complète" : `${confirmed}/${minSize} minimum`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Code à donner à tes coéquipiers</span>
          <span className="font-mono font-semibold text-lg tracking-widest">{team.joinCode}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          aria-label={copied ? "Code copié" : "Copier le code"}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">
          {team.members.length}/{maxSize} membre{team.members.length > 1 ? "s" : ""}
        </span>
        <ul className="flex flex-col gap-1 text-sm">
          {team.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2">
              {m.userId === team.captainId ? (
                <Crown aria-label="Capitaine" className="size-4 shrink-0 text-primary" />
              ) : (
                <span aria-hidden className="size-4 shrink-0" />
              )}
              <span className="truncate">{m.name}</span>
              {m.status === "waitlisted" ? (
                <span className="text-muted-foreground text-xs">· liste d'attente</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
