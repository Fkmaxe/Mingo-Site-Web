import { z } from "zod";

const Answers = z.record(z.string(), z.unknown()).default({});

export const CreateTeamInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nom d'équipe trop court")
      .max(40, "Nom d'équipe trop long (40 max)"),
    answers: Answers,
  })
  .meta({ id: "CreateTeamInput" });
export type CreateTeamInput = z.input<typeof CreateTeamInput>;

export const JoinTeamInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6}$/, "Le code d'équipe fait 6 caractères"),
    answers: Answers,
  })
  .meta({ id: "JoinTeamInput" });
export type JoinTeamInput = z.input<typeof JoinTeamInput>;

export const TeamDto = z
  .object({
    id: z.uuid(),
    name: z.string(),
    /** Shown to the team's members and to organisers only. */
    joinCode: z.string(),
    captainId: z.uuid(),
    members: z.array(
      z.object({
        userId: z.uuid(),
        name: z.string(),
        promo: z.string().nullable(),
        status: z.enum(["confirmed", "waitlisted"]),
      }),
    ),
    /** At least the minimum size of confirmed members. */
    complete: z.boolean(),
  })
  .meta({ id: "Team" });
export type TeamDto = z.infer<typeof TeamDto>;
