import { z } from "zod";
import { OPEN_POINTS_SOURCES, OPEN_POINTS_STATUSES } from "../enums";

export const OpenPointsMovementDto = z
  .object({
    id: z.uuid(),
    delta: z.int(),
    reason: z.string(),
    source: z.enum(OPEN_POINTS_SOURCES),
    status: z.enum(OPEN_POINTS_STATUSES),
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
    event: z.object({ id: z.uuid(), slug: z.string(), title: z.string() }).nullable(),
  })
  .meta({ id: "OpenPointsMovement" });
export type OpenPointsMovementDto = z.infer<typeof OpenPointsMovementDto>;

const OpenPointsUser = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  promo: z.string().nullable(),
});

export const MyOpenPointsDto = z
  .object({
    schoolYear: z.object({ id: z.uuid(), label: z.string() }).nullable(),
    /** BDE members have a grade instead of open points. */
    isMember: z.boolean(),
    /** Validated (and exported) points of the current school year. */
    balance: z.int(),
    pending: z.int(),
    movements: z.array(OpenPointsMovementDto),
  })
  .meta({ id: "MyOpenPoints" });
export type MyOpenPointsDto = z.infer<typeof MyOpenPointsDto>;

export const LedgerEntryDto = OpenPointsMovementDto.extend({ user: OpenPointsUser }).meta({
  id: "LedgerEntry",
});
export type LedgerEntryDto = z.infer<typeof LedgerEntryDto>;

export const ListLedgerQuery = z.object({
  status: z.enum(OPEN_POINTS_STATUSES).default("pending"),
  eventId: z.uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const DecideOpenPointsInput = z
  .object({
    ids: z
      .array(z.uuid())
      .min(1, "Sélectionne au moins un mouvement")
      .max(200, "200 mouvements maximum à la fois"),
  })
  .meta({ id: "DecideOpenPointsInput" });
export type DecideOpenPointsInput = z.infer<typeof DecideOpenPointsInput>;

export const DecideOpenPointsResultDto = z
  .object({
    /** Moved out of `pending`. */
    updated: z.int(),
    /** Unknown ids or movements that were not pending anymore. */
    skipped: z.int(),
  })
  .meta({ id: "DecideOpenPointsResult" });

export const AdjustOpenPointsInput = z
  .object({
    userId: z.uuid("Étudiant invalide"),
    delta: z
      .int("Le nombre de points doit être entier")
      .min(-100, "100 points maximum")
      .max(100, "100 points maximum")
      .refine((n) => n !== 0, "Le nombre de points ne peut pas être 0"),
    /** Required: checked by the API (422) so the rule lives with the ledger. */
    reason: z.string().max(300, "Motif trop long (300 caractères max)"),
  })
  .meta({ id: "AdjustOpenPointsInput" });
export type AdjustOpenPointsInput = z.infer<typeof AdjustOpenPointsInput>;

export const OpenPointsAccountDto = z
  .object({ user: OpenPointsUser, isMember: z.boolean(), balance: z.int(), pending: z.int() })
  .meta({ id: "OpenPointsAccount" });
export type OpenPointsAccountDto = z.infer<typeof OpenPointsAccountDto>;

export const SearchAccountsQuery = z.object({
  q: z.string().trim().min(2, "Tape au moins 2 lettres").max(100),
});
