import { formatRate } from "./format";
import type { MemberInvolvement } from "./types";

export function MembersView({ involvement }: { involvement: MemberInvolvement }) {
  const members = [...involvement.members].sort(
    (a, b) => b.staffShifts - a.staffShifts || a.user.name.localeCompare(b.user.name, "fr"),
  );
  return (
    <div className="flex flex-col gap-6">
      {involvement.byPole.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {involvement.byPole.map((p) => (
            <li
              key={p.pole.id}
              className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm"
            >
              <span className="font-bold font-display">{p.pole.name}</span>
              <span className="text-muted-foreground text-xs">
                {p.members} membre{p.members > 1 ? "s" : ""}
              </span>
              <span className="text-sm">
                <strong className="font-semibold">{p.staffShifts}</strong> créneaux staff ·{" "}
                <strong className="font-semibold">{p.meetingsAttended}</strong> présences en réunion
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {members.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun membre cette année.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-primary/5 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Membre
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Staff
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Réunions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {members.map((m) => (
                <tr key={m.user.id}>
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    <span className="block font-semibold">{m.user.name}</span>
                    <span className="block text-muted-foreground text-xs">
                      {[m.board ? "Bureau" : null, ...m.poles].filter(Boolean).join(" · ")}
                    </span>
                  </th>
                  <td className="px-2 py-2.5 text-right">{m.staffShifts}</td>
                  <td className="px-4 py-2.5 text-right">
                    {m.meetingsAttended}/{m.meetingsHeld}
                    <span className="block text-muted-foreground text-xs">
                      {formatRate(m.meetingRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
