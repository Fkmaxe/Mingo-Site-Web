import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { formatEventTimes } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import { type EventPhase, eventPhase, PHASE_LABELS, type ShowcaseEvent } from "../events";
import { excerpt, formatDayWithYear } from "../format";
import { eventHref } from "../routes";
import { Reveal } from "./reveal";

const BADGE_TONES: Record<EventPhase, string> = {
  ongoing: "bg-secondary text-secondary-foreground",
  upcoming: "bg-primary text-primary-foreground",
  past: "border border-border text-foreground",
  cancelled: "bg-destructive text-white",
};

/**
 * Showcase event card, linked to the event's page in the app (details, registration).
 * What is coming stands out; past events stay as a record of the association's activity.
 */
export function EventCard({
  event,
  now,
  headingLevel: Heading = "h3",
}: {
  readonly event: ShowcaseEvent;
  readonly now: Date;
  readonly headingLevel?: "h3" | "h4" | undefined;
}) {
  const phase = eventPhase(event, now);
  const live = phase === "upcoming" || phase === "ongoing";
  return (
    <Link
      href={eventHref(event.slug)}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-xs outline-none ring-1 ring-foreground/10 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring",
        live && "ring-2 ring-primary",
        phase === "cancelled" && "opacity-80",
      )}
    >
      {event.posterUrl ? (
        // biome-ignore lint/performance/noImgElement: posters are external URLs of any host.
        <img
          src={event.posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <span
          className={cn(
            "w-fit rounded-full px-2.5 py-0.5 font-semibold text-xs",
            BADGE_TONES[phase],
          )}
        >
          {PHASE_LABELS[phase]}
        </span>
        <Heading className="heading-display text-2xl leading-tight">{event.title}</Heading>
        {event.description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {excerpt(event.description)}
          </p>
        ) : null}
        <ul className="mt-auto flex flex-col gap-2 pt-1 text-sm">
          <li className="flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <time dateTime={event.startsAt}>{formatDayWithYear(event.startsAt)}</time>
          </li>
          <li className="flex items-center gap-2">
            <Clock aria-hidden className="size-4 shrink-0" />
            {formatEventTimes(event.startsAt, event.endsAt)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {event.location}
          </li>
        </ul>
        <span className="flex items-center gap-1.5 pt-1 font-semibold text-primary text-sm">
          {live ? "Détails et inscription" : "Voir l'événement"}
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

/** The column count follows the card count: one card alone does not sit in a 3-column grid. */
const COLUMNS: Record<number, string> = {
  1: "sm:max-w-md",
  2: "sm:max-w-3xl sm:grid-cols-2",
};

export function EventList({
  events,
  now,
  headingLevel,
}: {
  readonly events: readonly ShowcaseEvent[];
  readonly now: Date;
  readonly headingLevel?: "h3" | "h4" | undefined;
}) {
  return (
    <ul className={cn("grid gap-5", COLUMNS[events.length] ?? "sm:grid-cols-2 lg:grid-cols-3")}>
      {events.map((event, index) => (
        <Reveal as="li" key={event.id} delay={index * 80}>
          <EventCard event={event} now={now} headingLevel={headingLevel} />
        </Reveal>
      ))}
    </ul>
  );
}
