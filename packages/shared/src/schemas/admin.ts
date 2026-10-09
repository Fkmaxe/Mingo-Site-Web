import { z } from "zod";
import { BOARD_POSITIONS, MEMBERSHIP_ROLES } from "../enums";

// --- School years ---

export const SchoolYearDto = z
  .object({
    id: z.uuid(),
    label: z.string(),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    isCurrent: z.boolean(),
  })
  .meta({ id: "SchoolYear" });
export type SchoolYearDto = z.infer<typeof SchoolYearDto>;

export const CreateSchoolYearInput = z
  .object({
    label: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, "Format attendu : 2026-2027"),
    startsOn: z.iso.date("Date de début invalide"),
    endsOn: z.iso.date("Date de fin invalide"),
  })
  .refine((v) => v.endsOn > v.startsOn, {
    path: ["endsOn"],
    message: "La fin doit être après le début",
  })
  .meta({ id: "CreateSchoolYearInput" });
export type CreateSchoolYearInput = z.input<typeof CreateSchoolYearInput>;

// --- Poles ---

export const PoleInput = z
  .object({
    name: z.string().trim().min(2, "Nom trop court").max(60, "60 caractères maximum"),
    description: z.string().trim().max(500, "500 caractères maximum").nullable().default(null),
  })
  .meta({ id: "PoleInput" });
export type PoleInput = z.input<typeof PoleInput>;

// --- Members and roles ---

export const AdminMembershipDto = z.object({
  id: z.uuid(),
  role: z.enum(MEMBERSHIP_ROLES),
  boardPosition: z.enum(BOARD_POSITIONS).nullable(),
  pole: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type AdminMembershipDto = z.infer<typeof AdminMembershipDto>;

export const AdminUserDto = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    promo: z.string().nullable(),
    isAdmin: z.boolean(),
    /** False until the person clicked the link of the confirmation mail. */
    emailVerified: z.boolean(),
    createdAt: z.iso.datetime(),
    /** Active memberships of the current school year. */
    memberships: z.array(AdminMembershipDto),
  })
  .meta({ id: "AdminUser" });
export type AdminUserDto = z.infer<typeof AdminUserDto>;

export const ADMIN_USER_SCOPES = ["all", "roles", "unverified"] as const;

export const AdminUsersQuery = z.object({
  /** Name or email, within the scope. */
  q: z.string().trim().max(100).optional(),
  /** all: every account, newest first; roles: this year's role holders and the admins. */
  scope: z.enum(ADMIN_USER_SCOPES).default("all"),
});

export const AdminUsersDto = z
  .object({
    items: z.array(AdminUserDto),
    /** Accounts matching, beyond the 100 listed. */
    total: z.int(),
  })
  .meta({ id: "AdminUsers" });

/** Gives someone a role for the current school year (creates or updates the membership). */
export const SetMembershipInput = z
  .object({
    userId: z.uuid(),
    role: z.enum(MEMBERSHIP_ROLES),
    /** Required for member / pole_lead; null for the board. */
    poleId: z.uuid().nullable().default(null),
    boardPosition: z.enum(BOARD_POSITIONS).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.role === "board" && v.poleId !== null) {
      ctx.addIssue({ code: "custom", path: ["poleId"], message: "Le bureau n'a pas de pôle" });
    }
    if (v.role !== "board" && v.poleId === null) {
      ctx.addIssue({ code: "custom", path: ["poleId"], message: "Choisis un pôle" });
    }
    if (v.role !== "board" && v.boardPosition !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["boardPosition"],
        message: "Seul un membre du bureau a un poste",
      });
    }
  })
  .meta({ id: "SetMembershipInput" });
export type SetMembershipInput = z.input<typeof SetMembershipInput>;

export const SetAdminInput = z.object({ isAdmin: z.boolean() }).meta({ id: "SetAdminInput" });

// --- Audit log ---

export const AuditEntryDto = z
  .object({
    id: z.uuid(),
    action: z.string(),
    entity: z.string(),
    entityId: z.string().nullable(),
    payload: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.iso.datetime(),
    actor: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  })
  .meta({ id: "AuditEntry" });
export type AuditEntryDto = z.infer<typeof AuditEntryDto>;

export const AuditQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
