import type { Team } from "./types";

/** Teams of a team event, for organisers: completeness and members at a glance. */
export function TeamsList({ teams, minSize }: { teams: Team[]; minSize: number }) {
  if (teams.length === 0) {
    return <p className="text-muted-foreground text-sm">Aucune équipe pour l'instant.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {teams.map((team) => {
        const confirmed = team.members.filter((m) => m.status === "confirmed").length;
        return (
          <li key={team.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{team.name}</span>
              <span
                className={
                  team.complete
                    ? "shrink-0 font-medium text-success text-xs"
                    : "shrink-0 font-medium text-warning text-xs"
                }
              >
                {team.complete ? "Complète" : `Incomplète (${confirmed}/${minSize})`}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              Code {team.joinCode} ·{" "}
              {team.members
                .map(
                  (m) =>
                    `${m.name}${m.userId === team.captainId ? " (capitaine)" : ""}${m.status === "waitlisted" ? " (attente)" : ""}`,
                )
                .join(", ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
