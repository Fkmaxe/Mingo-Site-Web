import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeagueManager } from "./league-manager";
import type { EventLeague, Tournament } from "./types";

const validate = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  validateResultsAction: validate,
  setLeagueSportAction: vi.fn(),
  createTournamentAction: vi.fn(),
  deleteTournamentAction: vi.fn(),
  drawBracketAction: vi.fn(),
  recordMatchAction: vi.fn(),
}));

const uid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const people = [1, 2, 3].map((n) => ({ userId: uid(n), teamId: null, name: `Joueur ${n}` }));

const tournament: Tournament = {
  id: uid(9),
  format: "bracket",
  poolCount: 0,
  qualifiersPerPool: 0,
  thirdPlace: false,
  status: "done",
  entrants: [1, 2, 3].map((n) => ({
    id: uid(n + 3),
    name: `Joueur ${n}`,
    userId: uid(n),
    teamId: null,
    seed: n,
    pool: null,
  })),
  pools: [],
  rounds: [],
  thirdPlaceMatch: null,
  // Joueur 3, then 1, then 2.
  ranking: [uid(6), uid(4), uid(5)],
};

const league: EventLeague = {
  sport: { id: uid(8), name: "Badminton" },
  canManage: true,
  teamEvent: false,
  tournament,
  results: null,
  rewardedPlaces: 2,
  sports: [{ id: uid(8), name: "Badminton" }],
  candidates: people,
};

describe("LeagueManager results", () => {
  beforeEach(() => validate.mockReset().mockResolvedValue({ ok: true }));

  it("prefills the rewarded places from the tournament ranking and validates them", async () => {
    render(<LeagueManager eventId={uid(7)} league={league} />);
    expect(screen.getByLabelText("1re place")).toHaveDisplayValue("Joueur 3");
    expect(screen.getByLabelText("2e place")).toHaveDisplayValue("Joueur 1");
    expect(screen.queryByLabelText("3e place")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Valider le classement" }));
    expect(validate).toHaveBeenCalledWith(uid(7), [
      { place: 1, userId: uid(3) },
      { place: 2, userId: uid(1) },
    ]);
  });

  it("blocks the same person on two places", async () => {
    render(<LeagueManager eventId={uid(7)} league={league} />);
    await userEvent.selectOptions(screen.getByLabelText("2e place"), "Joueur 3");
    expect(screen.getByRole("alert")).toHaveTextContent("une place");
    expect(screen.getByRole("button", { name: "Valider le classement" })).toBeDisabled();
  });

  it("offers a correction once validated", () => {
    render(
      <LeagueManager
        eventId={uid(7)}
        league={{
          ...league,
          results: { placements: [{ place: 1, name: "Joueur 2", userId: uid(2), teamId: null }] },
        }}
      />,
    );
    expect(screen.getByLabelText("1re place")).toHaveDisplayValue("Joueur 2");
    expect(screen.getByRole("button", { name: "Corriger le classement" })).toBeInTheDocument();
  });
});
