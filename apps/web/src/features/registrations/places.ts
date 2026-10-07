import type { Event } from "../events/types";

export function placesLabel(event: Event) {
  if (event.capacity === null) return `${event.confirmedCount} inscrit·e·s`;
  const left = Math.max(event.capacity - event.confirmedCount, 0);
  if (left === 0) {
    return event.waitlistCount > 0
      ? `Complet · ${event.waitlistCount} en liste d'attente`
      : "Complet";
  }
  return `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur ${event.capacity}`;
}
