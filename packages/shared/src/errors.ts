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
  "REGISTRATION_CLOSED",
  "DEADLINE_PASSED",
  "ALREADY_CHECKED_IN",
  "TICKET_NOT_VALID",
  "RATE_LIMITED",
  "MANUAL_ADJUSTMENT_REQUIRES_REASON",
  "MEMBERS_HAVE_NO_OPEN_POINTS",
  "NO_CURRENT_SCHOOL_YEAR",
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
