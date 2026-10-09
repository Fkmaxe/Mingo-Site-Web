import "server-only";
import { unstable_rethrow } from "next/navigation";
import { listEvents } from "@/features/events/queries";
import { getMe } from "@/lib/session";
import { type ShowcaseEvent, showcaseable } from "./events";

export type ShowcaseEvents = { current: ShowcaseEvent[]; past: ShowcaseEvent[] };

/**
 * Ongoing and upcoming events (not ended yet, soonest first), then past ones (latest first).
 * Visitors see public events; a signed-in student also sees the student ones. The showcase
 * must stay up when the API is not: an error shows the empty state instead of a crash.
 */
export async function getShowcaseEvents(limit = 12): Promise<ShowcaseEvents> {
  try {
    const [current, past] = await Promise.all([
      listEvents({ scope: "upcoming", limit }),
      listEvents({ scope: "past", limit }),
    ]);
    return { current: showcaseable(current.items), past: showcaseable(past.items) };
  } catch (error) {
    // Next's own signals (dynamic rendering, redirect) are not failures: let them through,
    // or the page would be prerendered at build time with no events.
    unstable_rethrow(error);
    console.error("Vitrine : événements indisponibles", error);
    return { current: [], past: [] };
  }
}

/** Signed-in user for the header, or null (also when the API is unreachable). */
export async function getVisitor() {
  try {
    return await getMe();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Vitrine : session indisponible", error);
    return null;
  }
}
