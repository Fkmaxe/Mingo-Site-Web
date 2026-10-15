import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { CalendarSync } from "@/features/calendar/calendar-sync";
import { monthOf, monthWeeks, parseMonth, shiftMonth } from "@/features/calendar/month";
import { getCalendar, getCalendarFeedUrl } from "@/features/calendar/queries";
import type { CalendarItem } from "@/features/calendar/types";
import { HOME } from "@/lib/breadcrumbs";
import { formatTime, parisToday } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendrier" };

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const KIND_ICONS = { event: CalendarDays, meeting: Users, task: CheckSquare } as const;
const KIND_DOTS = {
  event: "bg-primary",
  meeting: "bg-warning",
  task: "bg-destructive",
} as const;

const monthTitle = (month: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
const dayTitle = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

/** Every event, my meetings and my tasks with a deadline, month by month. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <Card>
        <CardDescription>Le calendrier est réservé aux membres du BDE.</CardDescription>
      </Card>
    );
  }
  const today = parisToday();
  const month = parseMonth((await searchParams).month, monthOf(today));
  const weeks = monthWeeks(month);
  const first = weeks[0]?.[0] ?? `${month}-01`;
  const last = weeks.at(-1)?.[6] ?? `${month}-28`;
  const [items, feedUrl] = await Promise.all([getCalendar(first, last), getCalendarFeedUrl()]);

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  const daysOfMonth = [...byDay.keys()].filter((d) => monthOf(d) === month).sort();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Calendrier" breadcrumb={[HOME]} />

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} aria-label="Mois précédent">
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="font-semibold text-lg first-letter:uppercase">{monthTitle(month)}</h2>
        <Button asChild variant="outline" size="icon">
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} aria-label="Mois suivant">
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-2 shadow-primary/5 shadow-sm">
        <div className="grid grid-cols-7 text-center text-muted-foreground text-xs" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed list, two days share a letter.
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day) => {
            const dayItems = byDay.get(day) ?? [];
            const inMonth = monthOf(day) === month;
            const label = `${dayTitle(day)}${dayItems.length > 0 ? `, ${dayItems.length} élément${dayItems.length > 1 ? "s" : ""}` : ""}`;
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full",
                    day === today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                <span className="flex h-2 gap-0.5" aria-hidden>
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={cn("size-1.5 rounded-full", KIND_DOTS[item.kind])}
                    />
                  ))}
                </span>
              </>
            );
            const cell = cn(
              "flex min-h-12 flex-col items-center gap-0.5 rounded-lg py-1 text-sm",
              !inMonth && "text-muted-foreground/60",
            );
            return (
              <li key={day}>
                {dayItems.length > 0 && inMonth ? (
                  <a
                    href={`#day-${day}`}
                    aria-label={label}
                    className={cn(cell, "hover:bg-accent/40")}
                  >
                    {content}
                  </a>
                ) : (
                  <span className={cell}>
                    <span className="sr-only">{label}</span>
                    <span aria-hidden className="contents">
                      {content}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <span aria-hidden className={cn("size-2 rounded-full", KIND_DOTS.event)} /> Événement
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className={cn("size-2 rounded-full", KIND_DOTS.meeting)} /> Réunion
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className={cn("size-2 rounded-full", KIND_DOTS.task)} /> Délai de
            tâche
          </span>
        </p>
      </div>

      {daysOfMonth.length === 0 ? (
        <Card>
          <CardDescription>Rien de prévu ce mois-ci.</CardDescription>
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {daysOfMonth.map((day) => (
            <li key={day} id={`day-${day}`} className="flex scroll-mt-20 flex-col gap-2">
              <h3
                className={cn(
                  "font-semibold text-sm first-letter:uppercase",
                  day === today && "text-primary",
                )}
              >
                {dayTitle(day)}
                {day === today ? " · aujourd'hui" : ""}
              </h3>
              <ul className="flex flex-col gap-2">
                {(byDay.get(day) ?? []).map((item) => {
                  const Icon = KIND_ICONS[item.kind];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.path}
                        className="flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-primary/5 shadow-sm transition-colors hover:bg-accent/40"
                      >
                        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={cn(
                              "font-medium leading-tight",
                              item.cancelled && "text-muted-foreground line-through",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {item.allDay || !item.startsAt
                              ? "Délai"
                              : `${formatTime(item.startsAt)}${item.endsAt && item.kind === "event" ? ` – ${formatTime(item.endsAt)}` : ""}`}
                            {item.location ? ` · ${item.location}` : ""}
                            {` · ${item.label}`}
                            {item.cancelled ? " · annulé" : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <CalendarSync url={feedUrl} />
    </div>
  );
}
