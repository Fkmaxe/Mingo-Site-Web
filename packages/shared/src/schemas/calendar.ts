import { z } from "zod";

export const CALENDAR_ITEM_KINDS = ["event", "meeting", "task"] as const;
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

/** Longest range of the calendar page: a month view with its overflowing weeks. */
export const CALENDAR_MAX_DAYS = 62;

export const CalendarQuery = z
  .object({
    from: z.iso.date("Date invalide"),
    /** Inclusive. */
    to: z.iso.date("Date invalide"),
  })
  .refine((q) => q.from <= q.to, { path: ["to"], message: "La fin est avant le début" })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 < CALENDAR_MAX_DAYS, {
    path: ["to"],
    message: `${CALENDAR_MAX_DAYS} jours au plus`,
  });
export type CalendarQuery = z.infer<typeof CalendarQuery>;

export const CalendarItemDto = z
  .object({
    /** Unique in the calendar: `event-<id>`, `meeting-<id>`, `task-<id>`. */
    id: z.string(),
    kind: z.enum(CALENDAR_ITEM_KINDS),
    title: z.string(),
    /** Paris day of the start (or the deadline of a task). */
    day: z.iso.date(),
    /** A task's deadline is a whole day: no times. */
    allDay: z.boolean(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    location: z.string(),
    /** Pole, kind of meeting, or board of the task. */
    label: z.string(),
    cancelled: z.boolean(),
    /** Page of the item on the web. */
    path: z.string(),
  })
  .meta({ id: "CalendarItem" });
export type CalendarItemDto = z.infer<typeof CalendarItemDto>;

export const CalendarFeedDto = z
  .object({
    /** https URL of the iCal feed; null until the member creates their link. */
    url: z.string().nullable(),
  })
  .meta({ id: "CalendarFeed" });
export type CalendarFeedDto = z.infer<typeof CalendarFeedDto>;
