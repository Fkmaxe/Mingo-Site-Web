import { BarChart } from "./bar-chart";
import { formatRate, shortMonth } from "./format";
import { StatGrid, StatTile } from "./stat-tile";
import type { YearOverview } from "./types";

export function OverviewView({ overview }: { overview: YearOverview }) {
  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <StatTile label="Événements" value={overview.events} />
        <StatTile label="Inscriptions" value={overview.registrations} />
        <StatTile label="Entrées pointées" value={overview.checkIns} />
        <StatTile label="Participants uniques" value={overview.uniqueParticipants} />
        <StatTile
          label="Taux de présence"
          value={formatRate(overview.attendanceRate)}
          hint="Événements commencés"
        />
      </StatGrid>

      <div className="flex flex-col gap-6 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
        {/* Two measures of different scale: two charts, never two axes. */}
        <BarChart
          title="Entrées pointées par mois"
          unit="entrées"
          empty="Aucun événement cette année."
          bars={overview.byMonth.map((m) => ({
            key: m.month,
            label: shortMonth(m.month),
            value: m.checkIns,
          }))}
        />
        <BarChart
          title="Événements par mois"
          unit="événements"
          empty="Aucun événement cette année."
          bars={overview.byMonth.map((m) => ({
            key: m.month,
            label: shortMonth(m.month),
            value: m.events,
          }))}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-display text-lg">Par pôle</h2>
        {overview.byPole.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun événement cette année.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-primary/5 shadow-sm">
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th scope="col" className="py-2 pr-1 pl-3 text-left font-medium sm:px-4">
                    Pôle
                  </th>
                  <th scope="col" className="px-1 py-2 text-right font-medium sm:px-2">
                    Évén.
                  </th>
                  <th scope="col" className="px-1 py-2 text-right font-medium sm:px-2">
                    Inscr.
                  </th>
                  <th scope="col" className="px-1 py-2 text-right font-medium sm:px-2">
                    Entrées
                  </th>
                  <th scope="col" className="py-2 pr-3 pl-1 text-right font-medium sm:px-4">
                    Présence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {overview.byPole.map((p) => (
                  <tr key={p.pole.id}>
                    <th scope="row" className="py-2.5 pr-1 pl-3 text-left font-semibold sm:px-4">
                      {p.pole.name}
                    </th>
                    <td className="px-1 py-2.5 text-right sm:px-2">{p.events}</td>
                    <td className="px-1 py-2.5 text-right sm:px-2">{p.registrations}</td>
                    <td className="px-1 py-2.5 text-right sm:px-2">{p.checkIns}</td>
                    <td className="py-2.5 pr-3 pl-1 text-right sm:px-4">
                      {formatRate(p.attendanceRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
