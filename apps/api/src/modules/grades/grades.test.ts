import { GradePeriodDto, MemberGradeDto, MyGradesDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import {
  createAttendance,
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
} from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

const Grades = z.array(MemberGradeDto);
const Result = z.object({ updated: z.number(), skipped: z.number() });
type Pole = Awaited<ReturnType<typeof createPole>>;

let sport: Pole;
let com: Pole;
let board: { id: string };
let lead: { id: string };
let member: { id: string };
let period: GradePeriodDto;

/** A time of the first quarter (Paris date), at noon UTC or later. */
const inQ1 = (day: string, hour = 12) => new Date(`2026-${day}T${hour}:00:00Z`);

beforeEach(async () => {
  await createSchoolYear({ label: "2026-2027", startsOn: "2026-09-01", endsOn: "2027-08-31" });
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  board = await createPersona("board");
  lead = await createPersona("pole_lead", { poleId: sport.id });
  member = await createPersona("member", { poleId: sport.id });
  const quarters = await readJson(
    await call("POST", "/v1/grade-periods/generate-quarters", board.id),
    z.array(GradePeriodDto),
  );
  const [q1] = quarters;
  if (!q1) throw new Error("trimestre manquant");
  period = q1;
});

async function attend(
  userId: string,
  day: string,
  extra: Parameters<typeof createEvent>[0] | null = null,
) {
  const event = await createEvent({
    poleId: sport.id,
    startsAt: inQ1(day),
    endsAt: inQ1(day, 14),
    ...extra,
  });
  await createAttendance({ eventId: event.id, userId });
  return event;
}

const grades = async (userId: string, query = "") =>
  readJson(await call("GET", `/v1/grade-periods/${period.id}/grades${query}`, userId), Grades);
const gradeOf = async (userId: string) => (await grades(lead.id)).find((g) => g.user.id === userId);
const save = (userId: string, membershipId: string, involvementPoints: number) =>
  call("PUT", `/v1/grade-periods/${period.id}/grades`, userId, { membershipId, involvementPoints });

describe("grade periods", () => {
  it("generates three quarters covering the school year, once", async () => {
    const periods = await readJson(
      await call("GET", "/v1/grade-periods", member.id),
      z.array(GradePeriodDto),
    );
    expect(
      periods.map((p) => [p.label, p.startsOn, p.endsOn, p.scaleMax, p.pointsPerPresence]),
    ).toEqual([
      ["Trimestre 1", "2026-09-01", "2026-12-31", 20, 1],
      ["Trimestre 2", "2027-01-01", "2027-03-31", 20, 1],
      ["Trimestre 3", "2027-04-01", "2027-08-31", 20, 1],
    ]);
    expect((await call("POST", "/v1/grade-periods/generate-quarters", board.id)).status).toBe(409);
    expect((await call("POST", "/v1/grade-periods/generate-quarters", lead.id)).status).toBe(403);
  });

  it("are configurable by the board", async () => {
    const res = await call("PATCH", `/v1/grade-periods/${period.id}`, board.id, {
      scaleMax: 10,
      pointsPerPresence: 0.5,
    });
    expect(await readJson(res, GradePeriodDto)).toMatchObject({
      scaleMax: 10,
      pointsPerPresence: 0.5,
    });
  });
});

describe("presence points", () => {
  it("count each event of the period once, with the event's override", async () => {
    const event = await attend(member.id, "10-01");
    await createAttendance({ eventId: event.id, userId: member.id, kind: "staff" });
    await attend(member.id, "10-15", { poleId: sport.id, memberPoints: 3 });
    await attend(member.id, "11-01", { poleId: sport.id, status: "cancelled" });
    const outside = await createEvent({
      poleId: sport.id,
      startsAt: new Date("2027-02-01T12:00:00Z"),
      endsAt: new Date("2027-02-01T14:00:00Z"),
    });
    await createAttendance({ eventId: outside.id, userId: member.id });

    expect(await gradeOf(member.id)).toMatchObject({
      presenceCount: 2,
      presencePoints: 4,
      involvementPoints: 0,
      finalScore: 4,
      status: "draft",
    });
  });
});

describe("grading workflow", () => {
  it("adds pole points, capped by the scale", async () => {
    await attend(member.id, "10-01", { poleId: sport.id, memberPoints: 5 });
    const target = await gradeOf(member.id);
    const res = await save(lead.id, target?.membershipId ?? "", 18);
    expect(await readJson(res, MemberGradeDto)).toMatchObject({
      presencePoints: 5,
      involvementPoints: 18,
      finalScore: 20,
    });
    expect((await save(lead.id, target?.membershipId ?? "", 21)).status).toBe(400);
  });

  it("lets only the lead of the pole (or the board) grade, and never board members", async () => {
    const otherLead = await createPersona("pole_lead", { poleId: com.id });
    const target = await gradeOf(member.id);
    expect((await save(otherLead.id, target?.membershipId ?? "", 5)).status).toBe(403);
    expect((await call("GET", `/v1/grade-periods/${period.id}/grades`, member.id)).status).toBe(
      403,
    );
    const all = await grades(board.id);
    expect(all.map((g) => g.user.id).sort()).toEqual([lead.id, member.id, otherLead.id].sort());
    expect(all.some((g) => g.user.id === board.id)).toBe(false);
    expect((await grades(otherLead.id)).map((g) => g.pole.name)).toEqual(["Communication"]);
  });

  it("submits, validates (frozen), then only the board can edit, with an audit entry", async () => {
    await attend(member.id, "10-01");
    const target = await gradeOf(member.id);
    await save(lead.id, target?.membershipId ?? "", 10);
    const submit = await call("POST", `/v1/grade-periods/${period.id}/submit`, lead.id, {
      poleId: sport.id,
    });
    expect((await readJson(submit, Result)).updated).toBe(1);

    const [submitted] = (await grades(board.id)).filter((g) => g.user.id === member.id);
    const validate = await call("POST", "/v1/grades/validate", board.id, { ids: [submitted?.id] });
    expect(await readJson(validate, Result)).toEqual({ updated: 1, skipped: 0 });

    // A presence added after validation does not change the frozen grade.
    await attend(member.id, "10-20");
    expect(await gradeOf(member.id)).toMatchObject({
      status: "validated",
      presencePoints: 1,
      finalScore: 11,
    });

    const locked = await save(lead.id, target?.membershipId ?? "", 12);
    expect((await readError(locked)).code).toBe("GRADE_LOCKED");
    const byBoard = await save(board.id, target?.membershipId ?? "", 12);
    expect(await readJson(byBoard, MemberGradeDto)).toMatchObject({
      finalScore: 13,
      status: "validated",
    });
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "grade.updated_after_validation"));
    expect(audit).toHaveLength(1);
  });

  it("shows members their presences, and their grade only once published", async () => {
    await attend(member.id, "10-01");
    const target = await gradeOf(member.id);
    await save(lead.id, target?.membershipId ?? "", 9);
    await call("POST", `/v1/grade-periods/${period.id}/submit`, lead.id, { poleId: sport.id });
    const id = (await gradeOf(member.id))?.id;
    await call("POST", "/v1/grades/validate", board.id, { ids: [id] });

    const before = await readJson(await call("GET", "/v1/me/grades", member.id), MyGradesDto);
    expect(before.periods[0]).toMatchObject({ presencePoints: 1, grade: null });
    expect(before.periods[0]?.presences).toHaveLength(1);

    expect((await call("POST", "/v1/grades/publish", lead.id, { ids: [id] })).status).toBe(403);
    await call("POST", "/v1/grades/publish", board.id, { ids: [id] });
    const after = await readJson(await call("GET", "/v1/me/grades", member.id), MyGradesDto);
    expect(after.periods[0]?.grade).toEqual({ involvementPoints: 9, finalScore: 10, comment: "" });
  });

  it("refuses to delete a period with validated grades", async () => {
    await attend(member.id, "10-01");
    const target = await gradeOf(member.id);
    await save(lead.id, target?.membershipId ?? "", 1);
    await call("POST", `/v1/grade-periods/${period.id}/submit`, lead.id, { poleId: sport.id });
    await call("POST", "/v1/grades/validate", board.id, { ids: [(await gradeOf(member.id))?.id] });
    expect((await call("DELETE", `/v1/grade-periods/${period.id}`, board.id)).status).toBe(409);
  });
});
