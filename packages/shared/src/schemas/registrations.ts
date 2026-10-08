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

const AnswersDto = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

/** Answers to the event's custom fields; checked by the API against the event's definition. */
export const RegisterInput = z
  .object({ answers: z.record(z.string(), z.unknown()).default({}) })
  .meta({ id: "RegisterInput" });
export type RegisterInput = z.input<typeof RegisterInput>;

/** A user's own registration: the ticket, with its QR token. */
export const TicketDto = z
  .object({
    id: z.uuid(),
    status: z.enum(REGISTRATION_STATUSES),
    /** Only valid at the door when `status` is `confirmed`. */
    qrToken: z.string(),
    /** 1 = next to get a place. Null unless waitlisted. */
    waitlistPosition: z.int().nullable(),
    createdAt: z.iso.datetime(),
    cancelledAt: z.iso.datetime().nullable(),
    answers: AnswersDto,
    team: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    /** The answers with the questions' labels, in the event's order, ready to display. */
    questions: z.array(z.object({ label: z.string(), answer: z.string() })),
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
    answers: AnswersDto,
    team: z.string().nullable(),
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
