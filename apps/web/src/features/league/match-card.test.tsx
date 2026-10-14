import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchCard } from "./match-card";
import type { TournamentMatch } from "./types";

const record = vi.hoisted(() => vi.fn());
const live = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ recordMatchAction: record, setMatchLiveAction: live }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function match(overrides: Partial<TournamentMatch> = {}): TournamentMatch {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    phase: "pool",
    pool: 0,
    round: 1,
    position: 0,
    a: { id: A, name: "Jeanne" },
    b: { id: B, name: "Karim" },
    winnerId: null,
    draw: false,
    scoreA: null,
    scoreB: null,
    live: false,
    editable: true,
    ...overrides,
  };
}

describe("MatchCard", () => {
  beforeEach(() => record.mockReset().mockResolvedValue({ ok: true }));

  it("sets the winner with one tap", async () => {
    render(<MatchCard match={match()} manage />);
    await userEvent.click(screen.getByRole("button", { name: "Karim gagne" }));
    expect(record).toHaveBeenCalledWith(match().id, { result: "b", scoreA: null, scoreB: null });
  });

  it("deduces the result from the score, a draw in pools", async () => {
    const user = userEvent.setup();
    render(<MatchCard match={match()} manage />);
    await user.click(screen.getByRole("button", { name: "Score" }));
    await user.type(screen.getByLabelText("Score de Jeanne"), "3");
    await user.type(screen.getByLabelText("Score de Karim"), "3");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(record).toHaveBeenCalledWith(match().id, { result: "draw", scoreA: 3, scoreB: 3 });
  });

  it("refuses a tied score in the bracket without calling the API", async () => {
    const user = userEvent.setup();
    render(<MatchCard match={match({ phase: "bracket", pool: null })} manage />);
    expect(screen.queryByRole("button", { name: "Nul" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Score" }));
    await user.type(screen.getByLabelText("Score de Jeanne"), "2");
    await user.type(screen.getByLabelText("Score de Karim"), "2");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pas d'égalité en phase finale");
    expect(record).not.toHaveBeenCalled();
  });

  it("is read-only for participants, the winner marked", () => {
    render(<MatchCard match={match({ winnerId: A, scoreA: 21, scoreB: 15 })} manage={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText("Vainqueur")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("shows a bye in the first round", () => {
    render(
      <MatchCard
        match={match({ phase: "bracket", pool: null, b: null, winnerId: A, editable: false })}
        manage
      />,
    );
    expect(screen.getByText("Exempt")).toBeInTheDocument();
  });

  it("starts a match not played yet, and shows it as live", async () => {
    live.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { rerender } = render(<MatchCard match={match()} manage />);
    await user.click(screen.getByRole("button", { name: "Lancer" }));
    expect(live).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", true);

    rerender(<MatchCard match={match({ live: true })} manage={false} />);
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });
});
