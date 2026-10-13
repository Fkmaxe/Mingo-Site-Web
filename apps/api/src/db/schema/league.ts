import {
  DEFAULT_LEAGUE_NAME,
  LEAGUE_POINTS_REASONS,
  TOURNAMENT_FORMATS,
  TOURNAMENT_PHASES,
  TOURNAMENT_STATUSES,
} from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { event } from "./events";
import { schoolYear } from "./organization";
import { team } from "./registrations";

export const tournamentFormat = pgEnum("tournament_format", TOURNAMENT_FORMATS);
export const tournamentStatus = pgEnum("tournament_status", TOURNAMENT_STATUSES);
export const tournamentPhase = pgEnum("tournament_phase", TOURNAMENT_PHASES);
export const leaguePointsReason = pgEnum("league_points_reason", LEAGUE_POINTS_REASONS);

/** Settings of the league for one school year. Defaults apply until the board saves them. */
export const leagueSeason = pgTable(
  "league_season",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .unique("league_season_school_year_unique")
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    name: text().notNull().default(DEFAULT_LEAGUE_NAME),
    prizes: text().notNull().default(""),
    /** Points of the 1st, 2nd… place. */
    placementPoints: integer().array().notNull().default(sql`'{10,7,5,3,2}'::integer[]`),
    participationPoints: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("league_season_participation_check", sql`${t.participationPoints} >= 0`),
    check(
      "league_season_placement_points_check",
      sql`cardinality(${t.placementPoints}) between 1 and 10`,
    ),
  ],
);

/** The tournament of an event: pools and/or knockout bracket. */
export const tournament = pgTable(
  "tournament",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .unique("tournament_event_unique")
      .references(() => event.id, { onDelete: "cascade" }),
    format: tournamentFormat().notNull(),
    poolCount: integer().notNull().default(0),
    qualifiersPerPool: integer().notNull().default(0),
    thirdPlace: boolean().notNull().default(true),
    status: tournamentStatus().notNull(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tournament_created_by_idx").on(t.createdBy)],
);

/** A player (individual event) or a team (team event) of a tournament. */
export const tournamentEntrant = pgTable(
  "tournament_entrant",
  {
    id: id(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    userId: uuid().references(() => user.id, { onDelete: "cascade" }),
    teamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    /** 1 = first seed (registration order). */
    seed: integer().notNull(),
    /** Pool index (0 = A), null without pools. */
    pool: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    check("tournament_entrant_one_check", sql`(${t.userId} is null) <> (${t.teamId} is null)`),
    unique("tournament_entrant_seed_unique").on(t.tournamentId, t.seed),
    unique("tournament_entrant_user_unique").on(t.tournamentId, t.userId),
    unique("tournament_entrant_team_unique").on(t.tournamentId, t.teamId),
    index("tournament_entrant_user_id_idx").on(t.userId),
    index("tournament_entrant_team_id_idx").on(t.teamId),
  ],
);

/**
 * A match. Pool matches are drawn with the tournament; bracket matches of later rounds get
 * their entrants as results come in.
 */
export const tournamentMatch = pgTable(
  "tournament_match",
  {
    id: id(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    phase: tournamentPhase().notNull(),
    pool: integer(),
    round: integer().notNull(),
    position: integer().notNull(),
    entrantAId: uuid().references((): AnyPgColumn => tournamentEntrant.id, {
      onDelete: "cascade",
    }),
    entrantBId: uuid().references((): AnyPgColumn => tournamentEntrant.id, {
      onDelete: "cascade",
    }),
    winnerId: uuid().references((): AnyPgColumn => tournamentEntrant.id, {
      onDelete: "set null",
    }),
    /** Pool matches only. */
    draw: boolean().notNull().default(false),
    scoreA: integer(),
    scoreB: integer(),
    updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tournament_match_slot_unique").on(
      t.tournamentId,
      t.phase,
      sql`coalesce(${t.pool}, -1)`,
      t.round,
      t.position,
    ),
    check("tournament_match_draw_check", sql`not (${t.draw} and ${t.winnerId} is not null)`),
    check(
      "tournament_match_pool_check",
      sql`(${t.phase} = 'pool') = (${t.pool} is not null) and (${t.draw} = false or ${t.phase} = 'pool')`,
    ),
    check(
      "tournament_match_scores_check",
      sql`(${t.scoreA} is null) = (${t.scoreB} is null) and coalesce(${t.scoreA}, 0) >= 0 and coalesce(${t.scoreB}, 0) >= 0`,
    ),
    index("tournament_match_entrant_a_idx").on(t.entrantAId),
    index("tournament_match_entrant_b_idx").on(t.entrantBId),
    index("tournament_match_winner_idx").on(t.winnerId),
    index("tournament_match_updated_by_idx").on(t.updatedBy),
  ],
);

/** Validated placements of a league event (current state; the ledger keeps the history). */
export const leagueResult = pgTable(
  "league_result",
  {
    id: id(),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    place: integer().notNull(),
    userId: uuid().references(() => user.id, { onDelete: "cascade" }),
    teamId: uuid().references(() => team.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("league_result_place_unique").on(t.eventId, t.place),
    check("league_result_one_check", sql`(${t.userId} is null) <> (${t.teamId} is null)`),
    check("league_result_place_check", sql`${t.place} >= 1`),
    index("league_result_user_id_idx").on(t.userId),
    index("league_result_team_id_idx").on(t.teamId),
    index("league_result_created_by_idx").on(t.createdBy),
  ],
);

/**
 * Ledger of league points: one row per movement, never updated or deleted. A new validation of
 * an event first cancels that event's points (`reversal`), then writes the new ones.
 */
export const leaguePoints = pgTable(
  "league_points",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    eventId: uuid()
      .notNull()
      .references(() => event.id, { onDelete: "restrict" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    points: integer().notNull(),
    reason: leaguePointsReason().notNull(),
    place: integer(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("league_points_nonzero_check", sql`${t.points} <> 0`),
    index("league_points_year_user_idx").on(t.schoolYearId, t.userId),
    index("league_points_event_user_idx").on(t.eventId, t.userId),
    index("league_points_user_id_idx").on(t.userId),
    index("league_points_created_by_idx").on(t.createdBy),
  ],
);
