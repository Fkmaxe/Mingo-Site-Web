import { BarChart } from "./bar-chart";
import { formatRate, shortDay } from "./format";
import { StatGrid, StatTile } from "./stat-tile";
import type { EventStats } from "./types";

/** An event's figures, on its management page. */
export function EventStatsView({ stats }: { stats: EventStats }) {
  const r = stats.registrations;
  const points = stats.openPoints.pending + stats.openPoints.validated;
  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatTile
          label="Inscrits"
          value={r.confirmed}
          hint={stats.capacity === null ? "Places illimitées" : `sur ${stats.capacity} places`}
        />
        {stats.teams ? (
          <StatTile
            label="Équipes inscrites"
            value={stats.teams.confirmed}
            hint={stats.teams.waitlisted > 0 ? `${stats.teams.waitlisted} en attente` : undefined}
          />
        ) : (
          <StatTile label="Liste d'attente" value={r.waitlisted} />
        )}
        <StatTile
          label="Présents"
          value={stats.started ? stats.checkedIn : "—"}
          hint={
            stats.started
              ? `Taux de présence ${formatRate(stats.attendanceRate)}`
              : "Après le début"
          }
        />
        <StatTile
          label="Absents"
          value={stats.noShows ?? "—"}
          hint={stats.started ? "Inscrits non venus" : "Après le début"}
        />
        <StatTile label="Désinscriptions" value={r.cancelled} />
        <StatTile
          label="Staff pointé"
          value={stats.staff.checkedIn}
          hint={`${stats.staff.validated} validé·e·s sur ${stats.staff.places} places`}
        />
        <StatTile
          label="Points open générés"
          value={points}
          hint={
            stats.openPoints.pending > 0 ? `dont ${stats.openPoints.pending} en attente` : undefined
          }
        />
      </StatGrid>
      <BarChart
        title="Inscriptions par jour"
        unit="inscriptions"
        empty="Aucune inscription pour l'instant."
        bars={stats.registrationsByDay.map((d) => ({
          key: d.day,
          label: shortDay(d.day),
          value: d.count,
        }))}
      />
    </div>
  );
}
