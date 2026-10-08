import { Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { dateBlock, formatEventTimes } from "@/lib/paris-time";
import { StatusBadge } from "./event-badges";
import type { Event } from "./types";

export function EventCard({ event, href }: { event: Event; href?: string }) {
  const date = dateBlock(event.startsAt);
  return (
    <Link
      href={href ?? `/events/${event.slug}`}
      className="group flex gap-4 rounded-2xl border bg-card p-3 pr-4 shadow-primary/5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div
        aria-hidden
        className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue py-2 text-white"
      >
        <span className="font-display font-extrabold text-2xl italic leading-none">{date.day}</span>
        <span className="font-semibold text-xs uppercase">{date.month}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold font-display leading-tight group-hover:text-primary">
            {event.title}
          </h3>
          {event.status !== "published" ? <StatusBadge status={event.status} /> : null}
        </div>
        <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <Clock aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{formatEventTimes(event.startsAt, event.endsAt)}</span>
        </p>
        <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <MapPin aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-secondary-foreground text-xs">
            {event.pole.name}
          </span>
          {event.teamMaxSize !== null ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 font-semibold text-accent-foreground text-xs">
              En équipe
            </span>
          ) : null}
          {event.myRegistration && event.myRegistration.status !== "cancelled" ? (
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-semibold text-success text-xs">
              {event.myRegistration.status === "confirmed" ? "Inscrit·e" : "Liste d'attente"}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function EventList({
  events,
  empty,
  hrefOf,
}: {
  events: Event[];
  empty: string;
  hrefOf?: (event: Event) => string;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-muted-foreground text-sm">
        {empty}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} {...(hrefOf ? { href: hrefOf(event) } : {})} />
        </li>
      ))}
    </ul>
  );
}
