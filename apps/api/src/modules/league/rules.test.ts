import { describe, expect, it } from "vitest";
import {
  type BracketMatch,
  buildBracket,
  competitionRanks,
  eventPoints,
  finalRanking,
  firstRound,
  formatProblem,
  isComplete,
  type PoolMatch,
  poolStandings,
  propagate,
  roundRobin,
  seedPositions,
  seedsFromPools,
  splitIntoPools,
  voidedResults,
} from "./rules";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

function play(
  matches: BracketMatch[],
  round: number,
  position: number,
  side: "a" | "b",
  kind: BracketMatch["kind"] = "bracket",
): BracketMatch[] {
  return propagate(
    matches.map((m) =>
      m.kind === kind && m.round === round && m.position === position
        ? { ...m, winner: side === "a" ? m.a : m.b }
        : m,
    ),
  );
}

const find = (matches: BracketMatch[], round: number, position: number, kind = "bracket") =>
  matches.find((m) => m.kind === kind && m.round === round && m.position === position);

describe("formatProblem", () => {
  it("needs 2 entrants, 2 per pool and a possible number of qualifiers", () => {
    expect(formatProblem(1, { format: "bracket", poolCount: 0, qualifiersPerPool: 0 })).toMatch(
      /au moins 2/,
    );
    expect(formatProblem(2, { format: "bracket", poolCount: 0, qualifiersPerPool: 0 })).toBeNull();
    expect(formatProblem(5, { format: "pools", poolCount: 3, qualifiersPerPool: 0 })).toMatch(
      /ne suffisent pas/,
    );
    expect(
      formatProblem(7, { format: "pools_bracket", poolCount: 2, qualifiersPerPool: 4 }),
    ).toMatch(/entre 1 et 3/);
    expect(
      formatProblem(3, { format: "pools_bracket", poolCount: 1, qualifiersPerPool: 1 }),
    ).toMatch(/au moins 2 qualifiés/);
    expect(
      formatProblem(8, { format: "pools_bracket", poolCount: 2, qualifiersPerPool: 2 }),
    ).toBeNull();
  });
});

describe("splitIntoPools", () => {
  it("snakes the seeds so pools are balanced", () => {
    expect(splitIntoPools(ids(8), 2)).toEqual([
      ["e1", "e4", "e5", "e8"],
      ["e2", "e3", "e6", "e7"],
    ]);
    expect(splitIntoPools(ids(7), 3)).toEqual([
      ["e1", "e6", "e7"],
      ["e2", "e5"],
      ["e3", "e4"],
    ]);
  });

  it.each([3, 5, 9, 13, 16])("keeps sizes within one for %i entrants in 3 pools", (n) => {
    const sizes = splitIntoPools(ids(n), 3).map((p) => p.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe("roundRobin", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("pairs everyone exactly once for %i entrants", (n) => {
    const matches = roundRobin(ids(n));
    expect(matches).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(matches.map((m) => [m.a, m.b].sort().join("-")));
    expect(pairs.size).toBe(matches.length);
    // Nobody plays twice in a round.
    for (const round of new Set(matches.map((m) => m.round))) {
      const players = matches.filter((m) => m.round === round).flatMap((m) => [m.a, m.b]);
      expect(new Set(players).size).toBe(players.length);
    }
    expect(Math.max(...matches.map((m) => m.round))).toBe(n % 2 ? n : n - 1);
  });
});

describe("poolStandings", () => {
  const m = (a: string, b: string, scoreA: number, scoreB: number): PoolMatch => ({
    pool: 0,
    a,
    b,
    scoreA,
    scoreB,
    result: scoreA > scoreB ? "a" : scoreA < scoreB ? "b" : "draw",
  });

  it("counts 3 points a win, 1 a draw, and sorts by points then difference", () => {
    const rows = poolStandings(
      ["e1", "e2", "e3"],
      [m("e1", "e2", 2, 1), m("e2", "e3", 3, 0), m("e1", "e3", 1, 1)],
    );
    expect(rows.map((r) => [r.entrantId, r.points, r.diff])).toEqual([
      ["e1", 4, 1],
      ["e2", 3, 2],
      ["e3", 1, -3],
    ]);
    expect(rows[0]).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, scoreFor: 3 });
  });

  it("falls back to scores for, then seed, in a three-way cycle", () => {
    // Each beat the next 1-0: 3 points, difference 0 and head-to-head 3 for all.
    const rows = poolStandings(
      ["e1", "e2", "e3"],
      [m("e1", "e2", 0, 1), m("e2", "e3", 0, 1), m("e1", "e3", 1, 0)],
    );
    expect(rows.map((r) => r.points)).toEqual([3, 3, 3]);
    expect(rows.map((r) => r.entrantId)).toEqual(["e1", "e2", "e3"]);
  });

  it("uses head-to-head when two are tied", () => {
    const rows = poolStandings(
      ["e1", "e2", "e3", "e4"],
      [
        m("e1", "e2", 1, 2),
        m("e1", "e3", 1, 0),
        m("e1", "e4", 1, 0),
        m("e2", "e3", 0, 1),
        m("e2", "e4", 1, 0),
        m("e3", "e4", 0, 1),
      ],
    );
    // e1: 6 pts, diff +1 ; e2: 6 pts, diff +1 ; e2 beat e1.
    expect(rows.slice(0, 2).map((r) => r.entrantId)).toEqual(["e2", "e1"]);
  });

  it("falls back to the seed when nothing separates them, and ignores unplayed matches", () => {
    const rows = poolStandings(
      ["e1", "e2"],
      [{ pool: 0, a: "e1", b: "e2", result: null, scoreA: null, scoreB: null }],
    );
    expect(rows.map((r) => [r.entrantId, r.played])).toEqual([
      ["e1", 0],
      ["e2", 0],
    ]);
  });

  it("treats a result without scores as 0-0 in the difference", () => {
    const rows = poolStandings(
      ["e1", "e2"],
      [{ pool: 0, a: "e1", b: "e2", result: "b", scoreA: null, scoreB: null }],
    );
    expect(rows.map((r) => [r.entrantId, r.points, r.diff])).toEqual([
      ["e2", 3, 0],
      ["e1", 0, 0],
    ]);
  });
});

describe("seeding", () => {
  it("places seeds the standard way", () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("crosses the pools: winner of A meets runner-up of B", () => {
    const seeds = seedsFromPools(
      [
        ["a1", "a2"],
        ["b1", "b2"],
      ],
      2,
    );
    const round = firstRound(seeds).map((m) => [m.a?.id, m.b?.id]);
    expect(round).toEqual([
      ["a1", "b2"],
      ["b1", "a2"],
    ]);
  });

  it("never pairs two entrants of the same pool in the first round when avoidable", () => {
    for (const pools of [2, 3, 4, 5, 6]) {
      for (const perPool of [1, 2, 3]) {
        const tables = Array.from({ length: pools }, (_, p) =>
          Array.from({ length: perPool }, (_, r) => `p${p}r${r}`),
        );
        const seeds = seedsFromPools(tables, perPool);
        if (seeds.length < 2) continue;
        for (const m of firstRound(seeds)) {
          if (m.a && m.b && perPool < 3) expect(m.a.pool).not.toBe(m.b.pool);
        }
      }
    }
  });
});

describe("buildBracket", () => {
  it("gives the byes to the best seeds and sends them to the next round", () => {
    const bracket = buildBracket(
      ids(6).map((id) => ({ id })),
      false,
    );
    const first = bracket.filter((m) => m.round === 1);
    expect(first.map((m) => [m.a, m.b])).toEqual([
      ["e1", null],
      ["e4", "e5"],
      ["e2", null],
      ["e3", "e6"],
    ]);
    expect(find(bracket, 2, 0)).toMatchObject({ a: "e1", b: null, winner: null });
    expect(find(bracket, 2, 1)).toMatchObject({ a: "e2", b: null });
    expect(bracket.filter((m) => m.round === 3)).toHaveLength(1);
  });

  it("plays out to a champion, with a third-place match between the semi-final losers", () => {
    let bracket = buildBracket(
      ids(4).map((id) => ({ id })),
      true,
    );
    expect(bracket).toHaveLength(4);
    bracket = play(bracket, 1, 0, "b"); // e4 beats e1
    bracket = play(bracket, 1, 1, "a"); // e2 beats e3
    expect(find(bracket, 2, 0)).toMatchObject({ a: "e4", b: "e2" });
    expect(find(bracket, 2, 0, "third_place")).toMatchObject({ a: "e1", b: "e3" });
    bracket = play(bracket, 2, 0, "b"); // e2 champion
    bracket = play(bracket, 2, 0, "b", "third_place"); // e3 third
    expect(isComplete([], bracket)).toBe(true);
    expect(finalRanking({ entrants: ids(4), pools: [], bracket })).toEqual([
      "e2",
      "e4",
      "e3",
      "e1",
    ]);
  });

  it("has no third-place match in a 2-entrant bracket", () => {
    const bracket = buildBracket([{ id: "e1" }, { id: "e2" }], true);
    expect(bracket).toEqual([
      { kind: "bracket", round: 1, position: 0, a: "e1", b: "e2", winner: null },
    ]);
  });

  it.each([2, 3, 5, 7, 9, 12, 16])("builds a complete bracket for %i entrants", (n) => {
    let bracket = buildBracket(
      ids(n).map((id) => ({ id })),
      true,
    );
    // Always pick side a when both are there, until the end.
    for (let guard = 0; guard < 64 && !isComplete([], bracket); guard++) {
      const next = bracket.find((m) => m.a && m.b && !m.winner);
      if (!next) break;
      bracket = play(bracket, next.round, next.position, "a", next.kind);
    }
    expect(isComplete([], bracket)).toBe(true);
    const ranking = finalRanking({ entrants: ids(n), pools: [], bracket });
    expect(new Set(ranking).size).toBe(n);
    expect(ranking[0]).toBe("e1");
  });
});

describe("corrections", () => {
  it("moves the new winner on, and counts the later results it would void", () => {
    let bracket = buildBracket(
      ids(4).map((id) => ({ id })),
      false,
    );
    bracket = play(bracket, 1, 0, "a"); // e1
    bracket = play(bracket, 1, 1, "a"); // e2
    const before = bracket;
    const changed = play(before, 1, 0, "b"); // e4 instead of e1, final not played
    expect(find(changed, 2, 0)).toMatchObject({ a: "e4", b: "e2" });
    expect(voidedResults(before, changed, { kind: "bracket", round: 1, position: 0 })).toBe(0);

    const finalPlayed = play(before, 2, 0, "a");
    const late = play(finalPlayed, 1, 0, "b");
    expect(find(late, 2, 0)?.winner).toBeNull();
    expect(voidedResults(finalPlayed, late, { kind: "bracket", round: 1, position: 0 })).toBe(1);
  });
});

describe("finalRanking", () => {
  it("orders the quarter-final losers by their pool record", () => {
    const pools = [poolStandings(["a1", "a2", "a3"], []), poolStandings(["b1", "b2", "b3"], [])];
    // Pretend records: a2 better than b2.
    const rows = pools.flat();
    for (const r of rows)
      r.points = r.entrantId.endsWith("1") ? 6 : r.entrantId.endsWith("2") ? 3 : 0;
    const a2 = rows.find((r) => r.entrantId === "a2");
    if (a2) a2.diff = 2;
    const entrants = ["a1", "b1", "a2", "b2", "a3", "b3"];
    let bracket = buildBracket(
      seedsFromPools(
        [
          ["a1", "a2"],
          ["b1", "b2"],
        ],
        2,
      ),
      false,
    );
    bracket = play(bracket, 1, 0, "a"); // a1 beats b2
    bracket = play(bracket, 1, 1, "a"); // b1 beats a2
    bracket = play(bracket, 2, 0, "b"); // b1 champion
    expect(finalRanking({ entrants, pools, bracket })).toEqual([
      "b1",
      "a1",
      "a2",
      "b2",
      "a3",
      "b3",
    ]);
  });

  it("ranks a pools-only tournament by rank in pool, then record", () => {
    const pools = [poolStandings(["a1", "a2"], []), poolStandings(["b1", "b2"], [])];
    expect(finalRanking({ entrants: ["a1", "b1", "a2", "b2"], pools, bracket: [] })).toEqual([
      "a1",
      "b1",
      "a2",
      "b2",
    ]);
  });
});

describe("eventPoints", () => {
  const scale = { placementPoints: [10, 7, 5, 3, 2], participationPoints: 1 };

  it("gives 1 point to every participant and the place bonus to the top 5", () => {
    const points = eventPoints(
      scale,
      ["u1", "u2", "u3", "u4", "u5", "u6"],
      [1, 2, 3, 4, 5].map((place) => ({ place, userIds: [`u${place}`] })),
    );
    expect([...points].map(([u, p]) => [u, p.participation + p.placement])).toEqual([
      ["u1", 11],
      ["u2", 8],
      ["u3", 6],
      ["u4", 4],
      ["u5", 3],
      ["u6", 1],
    ]);
  });

  it("gives every member of a placed team the points of the place, present or not", () => {
    const points = eventPoints(scale, ["u1"], [{ place: 2, userIds: ["u1", "u2"] }]);
    expect(points.get("u2")).toEqual({ participation: 1, placement: 7, place: 2 });
  });

  it("gives nothing for a place beyond the scale", () => {
    expect(eventPoints(scale, [], [{ place: 6, userIds: ["u1"] }]).get("u1")).toEqual({
      participation: 1,
      placement: 0,
      place: 6,
    });
  });
});

describe("competitionRanks", () => {
  it("shares the rank between ties", () => {
    expect(competitionRanks([20, 15, 15, 9, 9, 9, 1])).toEqual([1, 2, 2, 4, 4, 4, 7]);
    expect(competitionRanks([])).toEqual([]);
  });
});
