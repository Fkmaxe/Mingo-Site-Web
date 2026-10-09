import type { Event } from "@/features/events/types";

/** What the showcase needs from an API event. */
export type ShowcaseEvent = Pick<
  Event,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "location"
  | "startsAt"
  | "endsAt"
  | "status"
  | "posterUrl"
>;

export type EventPhase = "ongoing" | "upcoming" | "past" | "cancelled";

/** Where an event stands at `now`: the API only knows "upcoming" (not ended yet) and "past". */
export function eventPhase(
  event: Pick<ShowcaseEvent, "startsAt" | "endsAt" | "status">,
  now: Date,
): EventPhase {
  if (event.status === "cancelled") return "cancelled";
  const time = now.getTime();
  if (time < new Date(event.startsAt).getTime()) return "upcoming";
  if (time < new Date(event.endsAt).getTime()) return "ongoing";
  return "past";
}

export const PHASE_LABELS: Record<EventPhase, string> = {
  ongoing: "En cours",
  upcoming: "À venir",
  past: "Passé",
  cancelled: "Annulé",
};

/** Events shown publicly: drafts (visible to their managers through the API) never are. */
export function showcaseable<T extends Pick<ShowcaseEvent, "status">>(events: readonly T[]): T[] {
  return events.filter((event) => event.status !== "draft");
}

/**
 * Home page selection: what is coming (ongoing first, as the API sorts by start), or else the
 * latest past events, so the section is never an empty grid.
 */
export function homeSelection<T extends ShowcaseEvent>(
  current: readonly T[],
  past: readonly T[],
  count = 3,
): { events: T[]; showingPast: boolean } {
  const live = current.filter((event) => event.status !== "cancelled");
  if (live.length > 0) return { events: live.slice(0, count), showingPast: false };
  return {
    events: past.filter((e) => e.status !== "cancelled").slice(0, count),
    showingPast: true,
  };
}
