import { z } from "zod";
import { PersonNameFields } from "../auth";
import { APP_ROLES, BOARD_POSITIONS, MEMBERSHIP_ROLES } from "../enums";
import { PERMISSIONS } from "../permissions";

export const MembershipDto = z
  .object({
    id: z.uuid(),
    role: z.enum(MEMBERSHIP_ROLES),
    boardPosition: z.enum(BOARD_POSITIONS).nullable(),
    pole: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }).nullable(),
  })
  .meta({ id: "Membership" });
export type MembershipDto = z.infer<typeof MembershipDto>;

export const MeDto = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    promo: z.string().nullable(),
    image: z.string().nullable(),
    isAdmin: z.boolean(),
    /** Active memberships of the current school year. Empty for a student. */
    memberships: z.array(MembershipDto),
    /** Effective roles and permissions, used by the web to adapt the UI (never for security). */
    roles: z.array(z.enum(APP_ROLES)),
    permissions: z.array(z.enum(PERMISSIONS)),
  })
  .meta({ id: "Me" });
export type MeDto = z.infer<typeof MeDto>;

/** The only profile fields a user may change themselves (email, promo and roles are not). */
export const UpdateProfileInput = z.object(PersonNameFields).meta({ id: "UpdateProfileInput" });
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
