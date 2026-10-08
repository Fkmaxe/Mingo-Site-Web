import { z } from "zod";

/** Ratio 0..1 rounded to 3 decimals; null when there is nothing to divide by yet. */
const Rate = z.number().min(0).max(1).nullable();

export const EventStatsDto = z
  .object({
    eventId: z.uuid(),
    capacity: z.int().nullable(),
    started: z.boolean(),
    registrations: z.object({
      confirmed: z.int(),
      waitlisted: z.int(),
      cancelled: z.int(),
    }),
    /** Team event: teams with a place / waiting. Null for individual registrations. */
    teams: z.object({ confirmed: z.int(), waitlisted: z.int() }).nullable(),
    checkedIn: z.int(),
    /** Checked in / confirmed. Null before the event starts or without registrations. */
    attendanceRate: Rate,
    /** Confirmed people who did not come. Null before the event starts. */
    noShows: z.int().nullable(),
    staff: z.object({
      slots: z.int(),
      places: z.int(),
      validated: z.int(),
      checkedIn: z.int(),
    }),
    openPoints: z.object({ pending: z.int(), validated: z.int(), rejected: z.int() }),
    /** Registrations made each day (Paris time), cancelled ones included. */
    registrationsByDay: z.array(z.object({ day: z.iso.date(), count: z.int() })),
  })
  .meta({ id: "EventStats" });
export type EventStatsDto = z.infer<typeof EventStatsDto>;

const SchoolYear = z.object({ id: z.uuid(), label: z.string() });

export const StatsYearQuery = z.object({
  /** Default: the current school year. */
  schoolYearId: z.uuid().optional(),
});

export const YearOverviewDto = z
  .object({
    schoolYear: SchoolYear,
    /** Published or done events starting during the year. */
    events: z.int(),
    registrations: z.int(),
    checkIns: z.int(),
    uniqueParticipants: z.int(),
    /** Over events that have started: check-ins / confirmed registrations. */
    attendanceRate: Rate,
    byMonth: z.array(
      z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), events: z.int(), checkIns: z.int() }),
    ),
    byPole: z.array(
      z.object({
        pole: z.object({ id: z.uuid(), name: z.string() }),
        events: z.int(),
        registrations: z.int(),
        checkIns: z.int(),
        attendanceRate: Rate,
      }),
    ),
  })
  .meta({ id: "YearOverview" });
export type YearOverviewDto = z.infer<typeof YearOverviewDto>;

export const MemberInvolvementDto = z
  .object({
    schoolYear: SchoolYear,
    members: z.array(
      z.object({
        user: z.object({ id: z.uuid(), name: z.string() }),
        /** Poles of the member this year; empty for the board only. */
        poles: z.array(z.string()),
        board: z.boolean(),
        staffShifts: z.int(),
        meetingsAttended: z.int(),
        /** Past meetings of their poles plus general meetings. */
        meetingsHeld: z.int(),
        meetingRate: Rate,
      }),
    ),
    byPole: z.array(
      z.object({
        pole: z.object({ id: z.uuid(), name: z.string() }),
        members: z.int(),
        staffShifts: z.int(),
        meetingsAttended: z.int(),
      }),
    ),
  })
  .meta({ id: "MemberInvolvement" });
export type MemberInvolvementDto = z.infer<typeof MemberInvolvementDto>;
