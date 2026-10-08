import { describe, expect, it } from "vitest";
import { placesLabel } from "./places";

const event = (capacity: number | null, confirmedCount: number, waitlistCount = 0) => ({
  capacity,
  confirmedCount,
  waitlistCount,
  teamMaxSize: null,
  confirmedTeamCount: 0,
  waitlistTeamCount: 0,
});

const tournament = (capacity: number | null, teams: number, waitingTeams = 0) => ({
  capacity,
  confirmedCount: teams * 5,
  waitlistCount: waitingTeams * 5,
  teamMaxSize: 5,
  confirmedTeamCount: teams,
  waitlistTeamCount: waitingTeams,
});

describe("placesLabel", () => {
  it("counts the places left", () => {
    expect(placesLabel(event(10, 9))).toBe("1 place restante sur 10");
    expect(placesLabel(event(10, 3))).toBe("7 places restantes sur 10");
  });

  it("shows the waitlist once full", () => {
    expect(placesLabel(event(10, 10))).toBe("Complet");
    expect(placesLabel(event(10, 10, 4))).toBe("Complet · 4 en liste d'attente");
  });

  it("counts registrations when unlimited", () => {
    expect(placesLabel(event(null, 12))).toBe("12 inscrit·e·s");
  });

  it("counts teams for a team event", () => {
    expect(placesLabel(tournament(8, 7))).toBe("1 place d'équipe restante sur 8");
    expect(placesLabel(tournament(8, 3))).toBe("5 places d'équipe restantes sur 8");
    expect(placesLabel(tournament(8, 8, 2))).toBe("Complet · 2 équipes en liste d'attente");
    expect(placesLabel(tournament(null, 1))).toBe("1 équipe inscrite");
  });
});
