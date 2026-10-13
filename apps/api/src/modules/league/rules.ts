// Tournament and league rules (docs/context.md > Ligue sportive). Pure functions, no I/O.

export type MatchResult = "a" | "b" | "draw";

export type PoolMatch = {
  pool: number;
  a: string;
  b: string;
  result: MatchResult | null;
  scoreA: number | null;
  scoreB: number | null;
};

export type StandingRow = {
  entrantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  diff: number;
};

export type BracketMatch = {
  kind: "bracket" | "third_place";
  /** 1 = first round; the final is the last round. The third-place match has the final's round. */
  round: number;
  position: number;
  a: string | null;
  b: string | null;
  winner: string | null;
};

export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;

export type TournamentFormat = "pools_bracket" | "pools" | "bracket";

export type FormatOptions = {
  format: TournamentFormat;
  poolCount: number;
  qualifiersPerPool: number;
};

/** Why these options cannot work for `count` entrants, in French, or null. */
export function formatProblem(count: number, options: FormatOptions): string | null {
  if (count < 2) return "Il faut au moins 2 participants pour un tournoi.";
  if (options.format === "bracket") return null;
  if (options.poolCount < 1) return "Il faut au moins une poule.";
  if (count < options.poolCount * 2) {
    return `${count} participants ne suffisent pas pour ${options.poolCount} poules (2 minimum par poule).`;
  }
  if (options.format === "pools_bracket") {
    const smallest = Math.floor(count / options.poolCount);
    if (options.qualifiersPerPool < 1 || options.qualifiersPerPool > smallest) {
      return `Qualifiés par poule : entre 1 et ${smallest} (taille de la plus petite poule).`;
    }
    if (options.poolCount * options.qualifiersPerPool < 2) {
      return "Il faut au moins 2 qualifiés pour la phase finale.";
    }
  }
  return null;
}

/**
 * Splits entrants (in seed order) into pools, "snake" style: 1 2 3 / 6 5 4 / 7 8 9…, so the
 * best seeds are spread out and pool sizes differ by at most one.
 */
export function splitIntoPools<T>(seeded: readonly T[], poolCount: number): T[][] {
  const pools: T[][] = Array.from({ length: poolCount }, () => []);
  seeded.forEach((id, i) => {
    const row = Math.floor(i / poolCount);
    const col = i % poolCount;
    pools[row % 2 === 0 ? col : poolCount - 1 - col]?.push(id);
  });
  return pools;
}

/** Everyone plays everyone once (circle method): rounds where nobody plays twice. */
export function roundRobin(entrants: readonly string[]): { round: number; a: string; b: string }[] {
  const list: (string | null)[] = entrants.length % 2 ? [...entrants, null] : [...entrants];
  const n = list.length;
  const out: { round: number; a: string; b: string }[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) out.push({ round: r + 1, a, b });
    }
    // Keep the first one in place, rotate the others clockwise.
    const last = list.pop() ?? null;
    list.splice(1, 0, last);
  }
  return out;
}

function emptyRow(entrantId: string): StandingRow {
  return {
    entrantId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    diff: 0,
  };
}

function table(entrants: readonly string[], matches: readonly PoolMatch[]) {
  const rows = new Map(entrants.map((id) => [id, emptyRow(id)]));
  for (const m of matches) {
    const a = rows.get(m.a);
    const b = rows.get(m.b);
    if (!a || !b || !m.result) continue;
    a.played++;
    b.played++;
    a.scoreFor += m.scoreA ?? 0;
    a.scoreAgainst += m.scoreB ?? 0;
    b.scoreFor += m.scoreB ?? 0;
    b.scoreAgainst += m.scoreA ?? 0;
    if (m.result === "draw") {
      a.drawn++;
      b.drawn++;
      a.points += DRAW_POINTS;
      b.points += DRAW_POINTS;
    } else {
      const [winner, loser] = m.result === "a" ? [a, b] : [b, a];
      winner.won++;
      loser.lost++;
      winner.points += WIN_POINTS;
    }
  }
  for (const row of rows.values()) row.diff = row.scoreFor - row.scoreAgainst;
  return rows;
}

/**
 * Pool table, best first. Ties: points, score difference, head-to-head points between the
 * tied entrants, scores for, then seed (entrants order).
 */
export function poolStandings(
  entrants: readonly string[],
  matches: readonly PoolMatch[],
): StandingRow[] {
  const rows = table(entrants, matches);
  const seed = new Map(entrants.map((id, i) => [id, i]));
  const sorted = [...rows.values()].sort((x, y) => y.points - x.points || y.diff - x.diff);
  const out: StandingRow[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    const first = sorted[i];
    while (
      first &&
      j < sorted.length &&
      sorted[j]?.points === first.points &&
      sorted[j]?.diff === first.diff
    )
      j++;
    const group = sorted.slice(i, j);
    if (group.length > 1) {
      const ids = new Set(group.map((r) => r.entrantId));
      const h2h = table(
        [...ids],
        matches.filter((m) => ids.has(m.a) && ids.has(m.b)),
      );
      group.sort(
        (x, y) =>
          (h2h.get(y.entrantId)?.points ?? 0) - (h2h.get(x.entrantId)?.points ?? 0) ||
          y.scoreFor - x.scoreFor ||
          (seed.get(x.entrantId) ?? 0) - (seed.get(y.entrantId) ?? 0),
      );
    }
    out.push(...group);
    i = j;
  }
  return out;
}

/** Standard seeding of a bracket of `size` (power of 2): 1 v 8, 4 v 5, 2 v 7, 3 v 6… */
export function seedPositions(size: number): number[] {
  let positions = [1];
  while (positions.length < size) {
    const m = positions.length * 2;
    positions = positions.flatMap((p) => [p, m + 1 - p]);
  }
  return positions;
}

export function bracketSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

export type Seed = { id: string; pool?: number | undefined; tier?: number | undefined };

/** Bracket seeds from the pool tables: every pool winner, then every runner-up… */
export function seedsFromPools(tables: readonly string[][], perPool: number): Seed[] {
  const seeds: Seed[] = [];
  for (let tier = 0; tier < perPool; tier++) {
    tables.forEach((ordered, pool) => {
      const id = ordered[tier];
      if (id) seeds.push({ id, pool, tier });
    });
  }
  return seeds;
}

/**
 * First round from the seeds (best first). The best seeds get the byes. Two entrants of the
 * same pool do not meet in the first round when a swap of same-tier entrants avoids it.
 */
export function firstRound(seeds: readonly Seed[]): { a: Seed | null; b: Seed | null }[] {
  const size = bracketSize(seeds.length);
  const positions = seedPositions(size);
  const matches = Array.from({ length: size / 2 }, (_, m) => ({
    a: seeds[(positions[2 * m] ?? 0) - 1] ?? null,
    b: seeds[(positions[2 * m + 1] ?? 0) - 1] ?? null,
  }));
  const clash = (x: Seed | null, y: Seed | null) =>
    x !== null && y !== null && x.pool !== undefined && x.pool === y.pool;
  for (const match of matches) {
    if (!clash(match.a, match.b)) continue;
    const other = matches.find(
      (o) =>
        o !== match &&
        o.b !== null &&
        o.b.tier === match.b?.tier &&
        !clash(match.a, o.b) &&
        !clash(o.a, match.b),
    );
    if (other) [match.b, other.b] = [other.b, match.b];
  }
  return matches;
}

/** Whole bracket: first round from the seeds, empty later rounds, optional third-place match. */
export function buildBracket(seeds: readonly Seed[], thirdPlace: boolean): BracketMatch[] {
  const first = firstRound(seeds);
  const rounds = Math.log2(first.length * 2);
  const matches: BracketMatch[] = first.map((m, position) => ({
    kind: "bracket",
    round: 1,
    position,
    a: m.a?.id ?? null,
    b: m.b?.id ?? null,
    winner: null,
  }));
  for (let round = 2; round <= rounds; round++) {
    for (let position = 0; position < 2 ** (rounds - round); position++) {
      matches.push({ kind: "bracket", round, position, a: null, b: null, winner: null });
    }
  }
  if (thirdPlace && rounds >= 2) {
    matches.push({
      kind: "third_place",
      round: rounds,
      position: 0,
      a: null,
      b: null,
      winner: null,
    });
  }
  return propagate(matches);
}

const loserOf = (m: BracketMatch | undefined) =>
  m?.winner && m.a && m.b ? (m.winner === m.a ? m.b : m.a) : null;

/**
 * Fills the later rounds from the results: winners move on, a first-round entrant without
 * opponent goes through (bye), semi-final losers play the third-place match. A result whose
 * entrants changed is cleared.
 */
export function propagate(input: readonly BracketMatch[]): BracketMatch[] {
  const matches = input.map((m) => ({ ...m }));
  const at = (round: number, position: number) =>
    matches.find((m) => m.kind === "bracket" && m.round === round && m.position === position);
  const rounds = Math.max(...matches.filter((m) => m.kind === "bracket").map((m) => m.round));
  const sorted = matches
    .filter((m) => m.kind === "bracket")
    .sort((x, y) => x.round - y.round || x.position - y.position);
  for (const m of sorted) {
    if (m.round > 1) {
      m.a = at(m.round - 1, 2 * m.position)?.winner ?? null;
      m.b = at(m.round - 1, 2 * m.position + 1)?.winner ?? null;
    }
    if (m.winner && m.winner !== m.a && m.winner !== m.b) m.winner = null;
    // Bye: alone in the first round, through without playing.
    if (m.round === 1 && (m.a === null) !== (m.b === null)) m.winner = m.a ?? m.b;
    if (m.winner && (!m.a || !m.b) && m.round > 1) m.winner = null;
  }
  const third = matches.find((m) => m.kind === "third_place");
  if (third) {
    third.a = loserOf(at(rounds - 1, 0));
    third.b = loserOf(at(rounds - 1, 1));
    if (third.winner && third.winner !== third.a && third.winner !== third.b) third.winner = null;
    if (!third.a || !third.b) third.winner = null;
  }
  return matches;
}

/**
 * Played matches whose opponents or winner a change would alter: a correction is refused if any.
 */
export function voidedResults(
  before: readonly BracketMatch[],
  after: readonly BracketMatch[],
  edited: { kind: BracketMatch["kind"]; round: number; position: number },
): number {
  const same = (x: BracketMatch, y: { kind: string; round: number; position: number }) =>
    x.kind === y.kind && x.round === y.round && x.position === y.position;
  return before.filter((b) => {
    if (same(b, edited) || !b.winner || !b.a || !b.b) return false;
    const a = after.find((m) => same(m, b));
    // Played between other opponents, or another winner: that result would be void.
    return a?.winner !== b.winner || a?.a !== b.a || a?.b !== b.b;
  }).length;
}

export type RankingInput = {
  /** Entrants in seed order. */
  entrants: readonly string[];
  /** Pool tables, best first (empty without pools). */
  pools: readonly StandingRow[][];
  bracket: readonly BracketMatch[];
};

/**
 * Final order of the tournament, best first: final winner, finalist, third-place match, then
 * by round of elimination; entrants eliminated at the same stage are ordered by their pool
 * record (rank in pool, points, difference, scores), then seed. Entrants out in the pools come
 * after the bracket, pool winners first.
 */
export function finalRanking({ entrants, pools, bracket }: RankingInput): string[] {
  const seed = new Map(entrants.map((id, i) => [id, i]));
  const record = new Map<string, { rank: number; row: StandingRow }>();
  for (const pool of pools) {
    pool.forEach((row, rank) => {
      record.set(row.entrantId, { rank, row });
    });
  }
  const byRecord = (x: string, y: string) => {
    const rx = record.get(x);
    const ry = record.get(y);
    if (rx && ry) {
      const d =
        rx.rank - ry.rank ||
        ry.row.points - rx.row.points ||
        ry.row.diff - rx.row.diff ||
        ry.row.scoreFor - rx.row.scoreFor;
      if (d) return d;
    }
    return (seed.get(x) ?? 0) - (seed.get(y) ?? 0);
  };

  const order: string[] = [];
  const placed = new Set<string>();
  const add = (ids: (string | null | undefined)[]) => {
    const fresh = ids.filter((id): id is string => Boolean(id) && !placed.has(id as string));
    fresh.sort(byRecord);
    for (const id of fresh) {
      placed.add(id);
      order.push(id);
    }
  };

  const games = bracket.filter((m) => m.kind === "bracket");
  if (games.length > 0) {
    const rounds = Math.max(...games.map((m) => m.round));
    const final = games.find((m) => m.round === rounds);
    add([final?.winner]);
    add([loserOf(final)]);
    const third = bracket.find((m) => m.kind === "third_place");
    if (third?.winner) {
      add([third.winner]);
      add([loserOf(third)]);
    }
    for (let round = rounds - 1; round >= 1; round--) {
      add(games.filter((m) => m.round === round).map(loserOf));
    }
    // Not decided yet: whoever is still in the bracket, deepest first.
    for (let round = rounds; round >= 1; round--) {
      add(games.filter((m) => m.round === round).flatMap((m) => [m.a, m.b]));
    }
  }
  add([...entrants]);
  return order;
}

/** Whether every match that can be played has a result. */
export function isComplete(pools: readonly PoolMatch[], bracket: readonly BracketMatch[]) {
  return (
    pools.every((m) => m.result !== null) && bracket.every((m) => m.winner !== null || !m.a || !m.b)
  );
}

export type LeagueScale = { placementPoints: readonly number[]; participationPoints: number };

/**
 * League points of an event: the participation point to everyone who came (checked in, or
 * placed), plus the points of the place (1st = placementPoints[0]…) to every placed person.
 */
export function eventPoints(
  scale: LeagueScale,
  participants: readonly string[],
  placements: readonly { place: number; userIds: readonly string[] }[],
): Map<string, { participation: number; placement: number; place: number | null }> {
  const out = new Map<string, { participation: number; placement: number; place: number | null }>();
  const ensure = (userId: string) => {
    let row = out.get(userId);
    if (!row) {
      row = { participation: scale.participationPoints, placement: 0, place: null };
      out.set(userId, row);
    }
    return row;
  };
  for (const userId of participants) ensure(userId);
  for (const { place, userIds } of placements) {
    const points = scale.placementPoints[place - 1] ?? 0;
    for (const userId of userIds) {
      const row = ensure(userId);
      if (row.place === null || place < row.place) {
        row.place = place;
        row.placement = points;
      }
    }
  }
  return out;
}

/** Ranks with ties sharing a rank (1, 2, 2, 4), from values sorted best first. */
export function competitionRanks(values: readonly number[]): number[] {
  return values
    .map((v, i) => (i > 0 && values[i - 1] === v ? -1 : i + 1))
    .reduce<number[]>((ranks, r, i) => {
      ranks.push(r === -1 ? (ranks[i - 1] ?? 1) : r);
      return ranks;
    }, []);
}
