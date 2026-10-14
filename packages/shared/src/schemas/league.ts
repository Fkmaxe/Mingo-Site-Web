import { z } from "zod";
import { TOURNAMENT_FORMATS, TOURNAMENT_PHASES, TOURNAMENT_STATUSES } from "../enums";

/** Default scale of the league: 1st 10, 2nd 7, 3rd 5, 4th 3, 5th 2, plus 1 for coming. */
export const DEFAULT_PLACEMENT_POINTS = [10, 7, 5, 3, 2] as const;
export const DEFAULT_PARTICIPATION_POINTS = 1;
export const DEFAULT_LEAGUE_NAME = "Ligue Sportive Interne";

const Points = z.int("Nombre entier").min(0, "0 minimum").max(100, "100 maximum");

export const LeagueSeasonInput = z
  .object({
    name: z.string().trim().min(2, "Nom trop court").max(60, "60 caractères maximum"),
    /** Free text, one prize per line (« 1er : PS5 »). */
    prizes: z.string().trim().max(500, "500 caractères maximum"),
    placementPoints: z
      .array(Points)
      .min(1, "Au moins une place récompensée")
      .max(10, "10 places maximum"),
    participationPoints: Points,
  })
  .meta({ id: "LeagueSeasonInput" });
export type LeagueSeasonInput = z.infer<typeof LeagueSeasonInput>;

export const SportInput = z
  .object({ name: z.string().trim().min(2, "Nom trop court").max(40, "40 caractères maximum") })
  .meta({ id: "SportInput" });
export type SportInput = z.infer<typeof SportInput>;

const SportDto = z.object({ id: z.uuid(), name: z.string(), eventCount: z.int() });

const Person = z.object({
  id: z.uuid(),
  name: z.string(),
  promo: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const LeagueDto = z
  .object({
    season: z.object({
      schoolYear: z.string(),
      name: z.string(),
      prizes: z.string(),
      placementPoints: z.array(z.int()),
      participationPoints: z.int(),
    }),
    sports: z.array(SportDto),
    /** Best first; ties share their rank. Filtered by class when asked. */
    standings: z.array(z.object({ rank: z.int(), user: Person, points: z.int(), events: z.int() })),
    /** League events whose results were validated, latest first. */
    events: z.array(
      z.object({
        id: z.uuid(),
        slug: z.string(),
        title: z.string(),
        startsAt: z.iso.datetime(),
        sport: z.string(),
        podium: z.array(z.object({ place: z.int(), name: z.string() })),
      }),
    ),
    canManage: z.boolean(),
  })
  .meta({ id: "League" });
export type LeagueDto = z.infer<typeof LeagueDto>;

/** The signed-in student's league season: rank, points and events. */
export const MyLeagueDto = z
  .object({
    /** Null between two school years. */
    seasonName: z.string().nullable(),
    /** Null without points yet. Ties share their rank. */
    rank: z.int().nullable(),
    points: z.int(),
    /** People with points this season. */
    ranked: z.int(),
    events: z.array(
      z.object({
        id: z.uuid(),
        slug: z.string(),
        title: z.string(),
        startsAt: z.iso.datetime(),
        points: z.int(),
        place: z.int().nullable(),
      }),
    ),
  })
  .meta({ id: "MyLeague" });
export type MyLeagueDto = z.infer<typeof MyLeagueDto>;

export const LeagueQuery = z.object({
  levelId: z.uuid().optional(),
  trackId: z.uuid().optional(),
});

export const SetLeagueSportInput = z
  .object({ sportId: z.uuid().nullable() })
  .meta({ id: "SetLeagueSportInput" });

export const CreateTournamentInput = z
  .object({
    format: z.enum(TOURNAMENT_FORMATS),
    /** Who plays: people (or teams) checked in at the entrance, or every confirmed registration. */
    source: z.enum(["checked_in", "registered"]),
    poolCount: z.int().min(1).max(16).default(2),
    qualifiersPerPool: z.int().min(1).max(8).default(2),
    thirdPlace: z.boolean().default(true),
  })
  .meta({ id: "CreateTournamentInput" });
export type CreateTournamentInput = z.input<typeof CreateTournamentInput>;
export type CreateTournamentData = z.output<typeof CreateTournamentInput>;

const Score = z.int().min(0).max(999).nullable();

export const RecordMatchInput = z
  .object({
    /** Winner side, a draw (pools only), or null to clear the result. */
    result: z.enum(["a", "b", "draw"]).nullable(),
    scoreA: Score.default(null),
    scoreB: Score.default(null),
  })
  .refine((v) => (v.scoreA === null) === (v.scoreB === null), {
    message: "Indique les deux scores ou aucun",
    path: ["scoreB"],
  })
  .refine(
    (v) =>
      v.result === null ||
      v.scoreA === null ||
      v.scoreB === null ||
      (v.result === "draw" ? v.scoreA === v.scoreB : (v.result === "a") === v.scoreA > v.scoreB),
    { message: "Le score ne correspond pas au vainqueur", path: ["result"] },
  )
  .meta({ id: "RecordMatchInput" });
export type RecordMatchInput = z.input<typeof RecordMatchInput>;
export type RecordMatchData = z.output<typeof RecordMatchInput>;

export const MatchLiveInput = z.object({ live: z.boolean() }).meta({ id: "MatchLiveInput" });
export type MatchLiveInput = z.infer<typeof MatchLiveInput>;

const Placement = z
  .object({
    place: z.int().min(1).max(10),
    userId: z.uuid().optional(),
    teamId: z.uuid().optional(),
  })
  .refine((p) => (p.userId === undefined) !== (p.teamId === undefined), {
    message: "Une personne ou une équipe par place",
  });

export const ValidateLeagueResultsInput = z
  .object({ placements: z.array(Placement).max(10) })
  .refine((v) => new Set(v.placements.map((p) => p.place)).size === v.placements.length, {
    message: "Chaque place une seule fois",
    path: ["placements"],
  })
  .refine(
    (v) => new Set(v.placements.map((p) => p.userId ?? p.teamId)).size === v.placements.length,
    { message: "Chaque participant une seule fois", path: ["placements"] },
  )
  .meta({ id: "ValidateLeagueResultsInput" });
export type ValidateLeagueResultsInput = z.infer<typeof ValidateLeagueResultsInput>;

const Side = z.object({ id: z.uuid(), name: z.string() }).nullable();

export const TournamentMatchDto = z.object({
  id: z.uuid(),
  phase: z.enum(TOURNAMENT_PHASES),
  /** Pool index (0 = A), null in the bracket. */
  pool: z.int().nullable(),
  round: z.int(),
  position: z.int(),
  a: Side,
  b: Side,
  winnerId: z.uuid().nullable(),
  draw: z.boolean(),
  scoreA: z.int().nullable(),
  scoreB: z.int().nullable(),
  /** Started by the organiser and not played yet: "en cours". */
  live: z.boolean(),
  /** Both sides known, and changing it would not void a later result. */
  editable: z.boolean(),
});
// No named schema (meta id): a nullable reference breaks the generated web types.
export type TournamentMatchDto = z.infer<typeof TournamentMatchDto>;

export const TournamentDto = z.object({
  id: z.uuid(),
  format: z.enum(TOURNAMENT_FORMATS),
  poolCount: z.int(),
  qualifiersPerPool: z.int(),
  thirdPlace: z.boolean(),
  status: z.enum(TOURNAMENT_STATUSES),
  entrants: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      userId: z.uuid().nullable(),
      teamId: z.uuid().nullable(),
      seed: z.int(),
      pool: z.int().nullable(),
    }),
  ),
  pools: z.array(
    z.object({
      index: z.int(),
      name: z.string(),
      standings: z.array(
        z.object({
          entrantId: z.uuid(),
          name: z.string(),
          played: z.int(),
          won: z.int(),
          drawn: z.int(),
          lost: z.int(),
          points: z.int(),
          diff: z.int(),
          qualified: z.boolean(),
        }),
      ),
      matches: z.array(TournamentMatchDto),
    }),
  ),
  /** Knockout rounds, first round first; empty until the bracket is drawn. */
  rounds: z.array(
    z.object({ round: z.int(), name: z.string(), matches: z.array(TournamentMatchDto) }),
  ),
  thirdPlaceMatch: TournamentMatchDto.nullable(),
  /** Entrant ids, best first, from the results so far. */
  ranking: z.array(z.uuid()),
});
export type TournamentDto = z.infer<typeof TournamentDto>;

const PlacementDto = z.object({
  place: z.int(),
  name: z.string(),
  userId: z.uuid().nullable(),
  teamId: z.uuid().nullable(),
});

export const EventLeagueDto = z
  .object({
    sport: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    /** The current user organises this event. */
    canManage: z.boolean(),
    teamEvent: z.boolean(),
    tournament: TournamentDto.nullable(),
    /** Validated placements (the league points were written), or null. */
    results: z.object({ placements: z.array(PlacementDto) }).nullable(),
    /** Number of places that earn points (length of the season's scale). */
    rewardedPlaces: z.int(),
    /** For the organiser: the sports the event can count for. */
    sports: z.array(z.object({ id: z.uuid(), name: z.string() })),
    /** For the organiser: people and teams that can be placed (confirmed registrations). */
    candidates: z.array(
      z.object({ userId: z.uuid().nullable(), teamId: z.uuid().nullable(), name: z.string() }),
    ),
  })
  .meta({ id: "EventLeague" });
export type EventLeagueDto = z.infer<typeof EventLeagueDto>;
