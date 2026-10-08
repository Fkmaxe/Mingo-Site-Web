import type { Event } from "../events/types";

type Counted = Pick<
  Event,
  | "capacity"
  | "confirmedCount"
  | "waitlistCount"
  | "teamMaxSize"
  | "confirmedTeamCount"
  | "waitlistTeamCount"
>;

/** Places left. The capacity of a team event counts teams, not people. */
export function placesLabel(event: Counted) {
  const teams = event.teamMaxSize !== null;
  const taken = teams ? event.confirmedTeamCount : event.confirmedCount;
  const waiting = teams ? event.waitlistTeamCount : event.waitlistCount;
  const waitingLabel = teams
    ? `${waiting} équipe${waiting > 1 ? "s" : ""} en liste d'attente`
    : `${waiting} en liste d'attente`;
  if (event.capacity === null) {
    return teams
      ? `${taken} équipe${taken > 1 ? "s" : ""} inscrite${taken > 1 ? "s" : ""}`
      : `${taken} inscrit·e·s`;
  }
  const left = Math.max(event.capacity - taken, 0);
  if (left === 0) return waiting > 0 ? `Complet · ${waitingLabel}` : "Complet";
  const unit = teams ? "place d'équipe" : "place";
  const units = teams ? "places d'équipe" : "places";
  return `${left} ${left > 1 ? units : unit} restante${left > 1 ? "s" : ""} sur ${event.capacity}`;
}
