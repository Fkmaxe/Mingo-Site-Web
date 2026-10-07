import { z } from "zod";
import { APPLICATION_STATUSES } from "../enums";

export const CreateApplicationInput = z
  .object({
    wishedPoleId: z.uuid("Choisis un pôle"),
    motivation: z
      .string()
      .trim()
      .min(20, "Dis-nous en un peu plus (20 caractères minimum)")
      .max(3000, "Motivation trop longue (3000 caractères max)"),
  })
  .meta({ id: "CreateApplicationInput" });
export type CreateApplicationInput = z.infer<typeof CreateApplicationInput>;

const ApplicationShape = z.object({
  id: z.uuid(),
  status: z.enum(APPLICATION_STATUSES),
  motivation: z.string(),
  wishedPole: z.object({ id: z.uuid(), name: z.string() }),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    promo: z.string().nullable(),
  }),
  createdAt: z.iso.datetime(),
});

export const ApplicationDto = ApplicationShape.meta({ id: "Application" });
export type ApplicationDto = z.infer<typeof ApplicationDto>;

/** Inline (not a $ref): a nullable reference is generated as an unusable allOf type. */
export const MyApplicationDto = ApplicationShape.nullable();

export const ListApplicationsQuery = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
});

export const DecideApplicationInput = z
  .object({ status: z.enum(["interview", "rejected"]) })
  .meta({ id: "DecideApplicationInput" });

export const AcceptApplicationInput = z
  .object({
    /** Defaults to the wished pole. */
    poleId: z.uuid().optional(),
  })
  .meta({ id: "AcceptApplicationInput" });
