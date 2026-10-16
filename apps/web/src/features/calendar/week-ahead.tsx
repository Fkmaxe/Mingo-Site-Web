import Link from "next/link";
import { CalendarItemRow } from "./calendar-item";
import { addDays } from "./month";
import type { CalendarItem } from "./types";

const shortDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayLabel(day: string, today: string) {
  if (day === today) return "aujourd'hui";
  if (day === addDays(today, 1)) return "demain";
  return shortDay.format(new Date(`${day}T12:00:00Z`));
}

/** The member's next 7 days on the home page: events, meetings, task deadlines. */
export function WeekAhead({ items, today }: { items: CalendarItem[]; today: string }) {
  const shown = items.slice(0, 5);
  return (
    <section aria-labelledby="week-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="week-title" className="font-bold font-display text-lg">
          Cette semaine
        </h2>
        <Link
          href="/calendar"
          className="font-semibold text-primary text-sm underline-offset-4 hover:underline"
        >
          Calendrier
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm">
          Rien de prévu dans les 7 prochains jours.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((item) => (
            <CalendarItemRow key={item.id} item={item} day={dayLabel(item.day, today)} />
          ))}
        </ul>
      )}
      {items.length > shown.length ? (
        <p className="text-muted-foreground text-xs">
          Et {items.length - shown.length} de plus dans le calendrier.
        </p>
      ) : null}
    </section>
  );
}
