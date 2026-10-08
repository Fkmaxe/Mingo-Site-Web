import type { EventStatsDto, MemberInvolvementDto, YearOverviewDto } from "@bde/shared";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { findManageableEvent } from "../events";
import { requireCurrentSchoolYear, schoolYearById } from "../school-years";
import { meetingsExpected, noShows, rate } from "./rules";
import {
  eventAttendanceCounts,
  eventOpenPoints,
  eventRegistrationCounts,
  eventRegistrationsByDay,
  eventStaffCounts,
  eventTeamCounts,
  type YearRange,
  yearByMonth,
  yearByPole,
  yearMeetingsAttended,
  yearMeetingsHeld,
  yearMemberships,
  yearStaffShifts,
  yearTotals,
} from "./stats.repo";

/** Figures of one event, for those who manage it (its pole lead or the board). */
export async function getEventStats(
  ctx: AuthedCtx,
  eventId: string,
  now: Date = new Date(),
): Promise<EventStatsDto> {
  const event = await findManageableEvent(ctx, eventId);
  const isTeamEvent = event.teamMinSize !== null && event.teamMaxSize !== null;
  const [registrations, teams, attendance, staff, points, byDay] = await Promise.all([
    eventRegistrationCounts(ctx.db, event.id),
    isTeamEvent ? eventTeamCounts(ctx.db, event.id) : Promise.resolve(null),
    eventAttendanceCounts(ctx.db, event.id),
    eventStaffCounts(ctx.db, event.id),
    eventOpenPoints(ctx.db, event.id),
    eventRegistrationsByDay(ctx.db, event.id),
  ]);
  const started = event.startsAt.getTime() <= now.getTime();
  return {
    eventId: event.id,
    capacity: event.capacity,
    started,
    registrations,
    teams,
    checkedIn: attendance.participants,
    attendanceRate: started ? rate(attendance.participants, registrations.confirmed) : null,
    noShows: noShows(registrations.confirmed, attendance.participants, started),
    staff: { ...staff, checkedIn: attendance.staff },
    openPoints: points,
    registrationsByDay: byDay,
  };
}

async function yearOf(ctx: AuthedCtx, schoolYearId: string | undefined, now: Date) {
  const id = schoolYearId ?? (await requireCurrentSchoolYear(ctx)).id;
  const year = await schoolYearById(ctx, id);
  if (!year) throw new AppError("NOT_FOUND", 404, "Cette année scolaire n'existe pas.");
  const range: YearRange = { startsOn: String(year.startsOn), endsOn: String(year.endsOn), now };
  return { schoolYear: { id: year.id, label: year.label }, range };
}

/** The year at a glance, for the board. */
export async function getYearOverview(
  ctx: AuthedCtx,
  query: { schoolYearId?: string | undefined },
  now: Date = new Date(),
): Promise<YearOverviewDto> {
  const { schoolYear, range } = await yearOf(ctx, query.schoolYearId, now);
  const [totals, months, poles] = await Promise.all([
    yearTotals(ctx.db, range),
    yearByMonth(ctx.db, range),
    yearByPole(ctx.db, range),
  ]);
  return {
    schoolYear,
    events: totals.events,
    registrations: totals.registrations,
    checkIns: totals.check_ins,
    uniqueParticipants: totals.unique_participants,
    attendanceRate: rate(totals.started_check_ins, totals.started_confirmed),
    byMonth: months.map((m) => ({ month: m.month, events: m.events, checkIns: m.check_ins })),
    byPole: poles.map((p) => ({
      pole: { id: p.pole_id, name: p.pole_name },
      events: p.events,
      registrations: p.registrations,
      checkIns: p.check_ins,
      attendanceRate: rate(p.started_check_ins, p.started_confirmed),
    })),
  };
}

/** Staff shifts and meeting attendance of every member of the year, for the board. */
export async function getMemberInvolvement(
  ctx: AuthedCtx,
  query: { schoolYearId?: string | undefined },
  now: Date = new Date(),
): Promise<MemberInvolvementDto> {
  const { schoolYear, range } = await yearOf(ctx, query.schoolYearId, now);
  const [memberships, shifts, held, attended] = await Promise.all([
    yearMemberships(ctx.db, schoolYear.id),
    yearStaffShifts(ctx.db, range),
    yearMeetingsHeld(ctx.db, range),
    yearMeetingsAttended(ctx.db, range),
  ]);
  const shiftsOf = new Map(shifts.map((s) => [s.user_id, s.n]));
  const attendedOf = new Map(attended.map((a) => [a.user_id, a.n]));
  const heldBy = new Map(held.map((h) => [h.pole_id, h.n]));

  const byUser = new Map<
    string,
    { name: string; poles: { id: string; name: string }[]; board: boolean }
  >();
  for (const m of memberships) {
    const entry = byUser.get(m.user_id) ?? { name: m.user_name, poles: [], board: false };
    if (m.role === "board") entry.board = true;
    if (m.pole_id && m.pole_name) entry.poles.push({ id: m.pole_id, name: m.pole_name });
    byUser.set(m.user_id, entry);
  }
  const members = [...byUser].map(([userId, m]) => {
    const meetingsHeld = meetingsExpected(
      m.poles.map((p) => p.id),
      heldBy,
    );
    const meetingsAttended = attendedOf.get(userId) ?? 0;
    return {
      user: { id: userId, name: m.name },
      poles: m.poles.map((p) => p.name),
      board: m.board,
      staffShifts: shiftsOf.get(userId) ?? 0,
      meetingsAttended,
      meetingsHeld,
      meetingRate: rate(meetingsAttended, meetingsHeld),
    };
  });

  const poles = new Map<string, MemberInvolvementDto["byPole"][number]>();
  for (const [userId, m] of byUser) {
    for (const p of m.poles) {
      const row = poles.get(p.id) ?? {
        pole: p,
        members: 0,
        staffShifts: 0,
        meetingsAttended: 0,
      };
      row.members += 1;
      row.staffShifts += shiftsOf.get(userId) ?? 0;
      row.meetingsAttended += attendedOf.get(userId) ?? 0;
      poles.set(p.id, row);
    }
  }
  return {
    schoolYear,
    members,
    byPole: [...poles.values()].sort((a, b) => a.pole.name.localeCompare(b.pole.name, "fr")),
  };
}
