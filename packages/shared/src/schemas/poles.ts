import { z } from "zod";

export const PoleDto = z
  .object({ id: z.uuid(), slug: z.string(), name: z.string(), description: z.string().nullable() })
  .meta({ id: "Pole" });
export type PoleDto = z.infer<typeof PoleDto>;
