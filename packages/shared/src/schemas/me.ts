import { z } from "zod";
import { BOARD_POSITIONS, MEMBERSHIP_ROLES } from "../enums";

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
    promo: z.string().nullable(),
    image: z.string().nullable(),
    isAdmin: z.boolean(),
    /** Active memberships of the current school year. Empty for a student. */
    memberships: z.array(MembershipDto),
  })
  .meta({ id: "Me" });
export type MeDto = z.infer<typeof MeDto>;
