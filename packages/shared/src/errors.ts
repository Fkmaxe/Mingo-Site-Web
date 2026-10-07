import { z } from "zod";

/** Stable error codes returned by the API. The web branches on these, never on messages. */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "DOMAIN_NOT_ALLOWED",
  "NOT_FOUND",
  "INVALID_STATUS_TRANSITION",
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
