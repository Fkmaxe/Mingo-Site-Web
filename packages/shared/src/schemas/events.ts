import { z } from "zod";
import {
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  REGISTRATION_STATES,
  REGISTRATION_STATUSES,
} from "../enums";

const IsoDateTime = z.iso.datetime({ offset: true, message: "Date invalide" });

const EventFields = z.object({
  poleId: z.uuid("Choisis un pôle"),
  title: z
    .string()
    .trim()
    .min(3, "Le titre doit faire au moins 3 caractères")
    .max(120, "Le titre doit faire au plus 120 caractères"),
  description: z.string().trim().max(5000, "La description est trop longue (5000 caractères max)"),
  location: z.string().trim().min(1, "Le lieu est obligatoire").max(200, "Le lieu est trop long"),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  visibility: z.enum(EVENT_VISIBILITIES, "Visibilité invalide"),
  /** Null: unlimited. */
  capacity: z
    .int("La capacité doit être un nombre entier")
    .positive("La capacité doit être positive")
    .max(10000, "Capacité trop grande")
    .nullable(),
  /** Null: registrations open until the event ends. */
  registrationDeadline: IsoDateTime.nullable(),
  openPointsValue: z
    .int("Les points open doivent être un nombre entier")
    .min(0, "Les points open ne peuvent pas être négatifs")
    .max(100, "Trop de points open (100 max)"),
  posterUrl: z.url("Adresse d'affiche invalide").nullable(),
});

type DateFields = {
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  registrationDeadline?: string | null | undefined;
};

/** Date coherence, shared by the create schema, the update service and the web form. */
export function eventDateIssues(
  dates: DateFields,
): { path: "endsAt" | "registrationDeadline"; message: string }[] {
  const issues: { path: "endsAt" | "registrationDeadline"; message: string }[] = [];
  if (dates.startsAt && dates.endsAt && Date.parse(dates.endsAt) <= Date.parse(dates.startsAt)) {
    issues.push({ path: "endsAt", message: "La fin doit être après le début" });
  }
  if (
    dates.registrationDeadline &&
    dates.endsAt &&
    Date.parse(dates.registrationDeadline) > Date.parse(dates.endsAt)
  ) {
    issues.push({
      path: "registrationDeadline",
      message: "La date limite d'inscription doit être avant la fin de l'événement",
    });
  }
  return issues;
}

function checkDates(value: DateFields, ctx: z.RefinementCtx) {
  for (const issue of eventDateIssues(value)) {
    ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
  }
}

export const CreateEventInput = EventFields.extend({
  description: EventFields.shape.description.default(""),
  capacity: EventFields.shape.capacity.default(null),
  registrationDeadline: EventFields.shape.registrationDeadline.default(null),
  openPointsValue: EventFields.shape.openPointsValue.default(0),
  posterUrl: EventFields.shape.posterUrl.default(null),
})
  .superRefine(checkDates)
  .meta({ id: "CreateEventInput" });
export type CreateEventInput = z.input<typeof CreateEventInput>;
/** After parsing: defaults applied. */
export type CreateEventData = z.output<typeof CreateEventInput>;

export const UpdateEventInput = EventFields.partial()
  .superRefine(checkDates)
  .meta({ id: "UpdateEventInput" });
export type UpdateEventInput = z.input<typeof UpdateEventInput>;
export type UpdateEventData = z.output<typeof UpdateEventInput>;

export const EVENT_SCOPES = ["upcoming", "past"] as const;

export const ListEventsQuery = z.object({
  scope: z.enum(EVENT_SCOPES).default("upcoming"),
  poleId: z.uuid().optional(),
  /** Only events the user can manage (drafts included). */
  manageable: z.stringbool().default(false),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEventsQuery = z.infer<typeof ListEventsQuery>;

export const EventDto = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    location: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    visibility: z.enum(EVENT_VISIBILITIES),
    status: z.enum(EVENT_STATUSES),
    capacity: z.int().nullable(),
    registrationDeadline: z.iso.datetime().nullable(),
    openPointsValue: z.int(),
    posterUrl: z.string().nullable(),
    pole: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
    /** Whether the current user may edit, publish or cancel it. */
    canManage: z.boolean(),
    confirmedCount: z.int(),
    registrationState: z.enum(REGISTRATION_STATES),
    /** The current user's registration, cancelled ones included. */
    myRegistration: z.object({ id: z.uuid(), status: z.enum(REGISTRATION_STATUSES) }).nullable(),
  })
  .meta({ id: "Event" });
export type EventDto = z.infer<typeof EventDto>;
