import { Avatar } from "@/components/avatar";
import type { Team } from "./types";

/** Teams of a team event, for organisers: completeness and members at a glance. */
export function TeamsList({ teams, minSize }: { teams: Team[]; minSize: number }) {
  if (teams.length === 0) {
    return <p className="text-muted-foreground text-sm">Aucune équipe pour l'instant.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {teams.map((team) => {
        return (
          <li key={team.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{team.name}</span>
              <span
                className={
                  team.complete && team.status === "confirmed"
                    ? "shrink-0 font-medium text-success text-xs"
                    : "shrink-0 font-medium text-warning text-xs"
                }
              >
                {team.status === "waitlisted"
                  ? `Attente n° ${team.waitlistPosition ?? "?"}`
                  : team.complete
                    ? "Complète"
                    : `Incomplète (${team.members.length}/${minSize})`}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">Code {team.joinCode}</span>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
              {team.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-1.5 text-xs">
                  <Avatar name={m.name} url={m.avatarUrl} size={24} />
                  {m.name}
                  {m.userId === team.captainId ? (
                    <span className="text-muted-foreground">(capitaine)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
