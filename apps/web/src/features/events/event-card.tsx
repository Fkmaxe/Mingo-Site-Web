import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { formatEventRange } from "@/lib/paris-time";
import { StatusBadge } from "./event-badges";
import type { Event } from "./types";

export function EventCard({ event, href }: { event: Event; href?: string }) {
  return (
    <Link
      href={href ?? `/events/${event.slug}`}
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-tight">{event.title}</h3>
        {event.status !== "published" ? <StatusBadge status={event.status} /> : null}
      </div>
      <p className="flex items-center gap-2 text-muted-foreground text-sm">
        <CalendarDays aria-hidden className="size-4 shrink-0" />
        <span className="first-letter:uppercase">
          {formatEventRange(event.startsAt, event.endsAt, true)}
        </span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground text-sm">
        <MapPin aria-hidden className="size-4 shrink-0" />
        {event.location}
      </p>
      <p className="text-primary text-xs">Pôle {event.pole.name}</p>
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
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
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
