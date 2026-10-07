import { z } from "zod";
import { REGISTRATION_STATUSES } from "../enums";

const EventSummary = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  location: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: z.enum(["draft", "published", "cancelled", "done"]),
});

/** A user's own registration: the ticket, with its QR token. */
export const TicketDto = z
  .object({
    id: z.uuid(),
    status: z.enum(REGISTRATION_STATUSES),
    qrToken: z.string(),
    createdAt: z.iso.datetime(),
    cancelledAt: z.iso.datetime().nullable(),
    event: EventSummary,
  })
  .meta({ id: "Ticket" });
export type TicketDto = z.infer<typeof TicketDto>;

export const ListTicketsQuery = z.object({
  scope: z.enum(["upcoming", "past"]).default("upcoming"),
});

/** A registration as seen by the organisers. Never exposes the QR token. */
export const RegistrantDto = z
  .object({
    id: z.uuid(),
    status: z.enum(REGISTRATION_STATUSES),
    createdAt: z.iso.datetime(),
    user: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.string(),
      promo: z.string().nullable(),
    }),
  })
  .meta({ id: "Registrant" });
export type RegistrantDto = z.infer<typeof RegistrantDto>;

export const ListRegistrantsQuery = z.object({
  status: z.enum(REGISTRATION_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
