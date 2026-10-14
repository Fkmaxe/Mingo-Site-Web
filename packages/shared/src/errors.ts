import { z } from "zod";

/** Stable error codes returned by the API. The web branches on these, never on messages. */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "DOMAIN_NOT_ALLOWED",
  "NOT_FOUND",
  "INVALID_STATUS_TRANSITION",
  "ALREADY_REGISTERED",
  "CAPACITY_BELOW_REGISTRATIONS",
  "STAFF_SLOT_FULL",
  "ALREADY_VOLUNTEERED",
  "NOT_A_MEMBER",
  "GRADE_LOCKED",
  "ALREADY_APPLIED",
  "ALREADY_MEMBER",
  "ALREADY_EXISTS",
  "NOT_AVAILABLE",
  "ALREADY_REVERSED",
  "TEAM_REQUIRED",
  "NOT_TEAM_EVENT",
  "TEAM_FULL",
  "TEAM_NAME_TAKEN",
  "TEAMS_LOCKED",
  "REGISTRATION_CLOSED",
  "DEADLINE_PASSED",
  "ALREADY_CHECKED_IN",
  "TICKET_NOT_VALID",
  "RATE_LIMITED",
  "MANUAL_ADJUSTMENT_REQUIRES_REASON",
  "MEMBERS_HAVE_NO_OPEN_POINTS",
  "NO_CURRENT_SCHOOL_YEAR",
  "TOURNAMENT_EXISTS",
  "INVALID_TOURNAMENT",
  "BRACKET_EXISTS",
  "POOLS_NOT_FINISHED",
  "MATCH_LOCKED",
  "MATCH_NOT_READY",
  "DRAW_NOT_ALLOWED",
  "NOT_A_LEAGUE_EVENT",
  "EVENT_HAS_LEAGUE_POINTS",
  "PLACE_OUT_OF_SCALE",
  "NOT_A_PARTICIPANT",
  "TRACK_NOT_OFFERED",
  "INITIATOR_NOT_MEMBER",
  "TOO_MANY_ATTACHMENTS",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ApiErrorBody = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: "ApiError" });

export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
