import { GradePeriodDto, MeetingDto, MemberGradeDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let board: { id: string };
let lead: { id: string };
let member: { id: string };

beforeEach(async () => {
  await createSchoolYear({ label: "2026-2027", startsOn: "2026-09-01", endsOn: "2027-08-31" });
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  board = await createPersona("board");
  lead = await createPersona("pole_lead", { poleId: sport.id });
  member = await createPersona("member", { poleId: sport.id });
});

const create = (userId: string, poleId: string | null, startsAt = "2026-10-12T17:00:00.000Z") =>
  call("POST", "/v1/meetings", userId, { poleId, title: "Réunion", startsAt, agenda: "1. Bilan" });

describe("meetings", () => {
  it("general meetings are for the board, pole meetings for the pole's lead", async () => {
    expect((await create(board.id, null)).status).toBe(201);
    expect((await create(lead.id, null)).status).toBe(403);
    expect((await create(lead.id, sport.id)).status).toBe(201);
    expect((await create(lead.id, com.id)).status).toBe(403);
    expect((await create(member.id, sport.id)).status).toBe(403);
  });

  it("are visible to members of the pole (pole meetings) or to every member (general)", async () => {
    await create(board.id, null, "2099-01-01T17:00:00.000Z");
    const poleMeeting = await readJson(
      await create(lead.id, sport.id, "2099-01-02T17:00:00.000Z"),
      MeetingDto,
    );
    const outsider = await createPersona("member", { poleId: com.id });

    const seen = async (userId: string) =>
      (await readJson(await call("GET", "/v1/meetings", userId), z.array(MeetingDto))).map(
        (m) => m.pole?.name ?? "Générale",
      );
    expect(await seen(member.id)).toEqual(["Générale", "Sport"]);
    expect(await seen(outsider.id)).toEqual(["Générale"]);
    expect((await call("GET", `/v1/meetings/${poleMeeting.id}`, outsider.id)).status).toBe(404);
    const student = await createPersona("student");
    expect((await call("GET", "/v1/meetings", student.id)).status).toBe(403);
  });

  it("take attendance among expected members, counted in the grade", async () => {
    const meeting = await readJson(await create(lead.id, sport.id), MeetingDto);
    const detail = await readJson(
      await call("GET", `/v1/meetings/${meeting.id}`, lead.id),
      MeetingDto,
    );
    expect(detail.attendees.map((a) => a.user.id).sort()).toEqual([lead.id, member.id].sort());

    const res = await call("PUT", `/v1/meetings/${meeting.id}/attendance`, lead.id, {
      userId: member.id,
      present: true,
    });
    expect(
      (await readJson(res, MeetingDto)).attendees.find((a) => a.user.id === member.id)?.present,
    ).toBe(true);
    const own = await readJson(
      await call("GET", `/v1/meetings/${meeting.id}`, member.id),
      MeetingDto,
    );
    expect([own.present, own.attendees]).toEqual([true, []]);

    const outsider = await createPersona("member", { poleId: com.id });
    const refused = await call("PUT", `/v1/meetings/${meeting.id}/attendance`, lead.id, {
      userId: outsider.id,
      present: true,
    });
    expect((await readError(refused)).code).toBe("NOT_A_MEMBER");

    const [period] = await readJson(
      await call("POST", "/v1/grade-periods/generate-quarters", board.id),
      z.array(GradePeriodDto),
    );
    const grades = await readJson(
      await call("GET", `/v1/grade-periods/${period?.id}/grades`, lead.id),
      z.array(MemberGradeDto),
    );
    expect(grades.find((g) => g.user.id === member.id)).toMatchObject({
      presenceCount: 1,
      presencePoints: 1,
    });

    await call("PUT", `/v1/meetings/${meeting.id}/attendance`, lead.id, {
      userId: member.id,
      present: false,
    });
    const after = await readJson(
      await call("GET", `/v1/meetings/${meeting.id}`, member.id),
      MeetingDto,
    );
    expect(after.present).toBe(false);
  });

  it("take minutes and are soft-deleted with an audit entry", async () => {
    const meeting = await readJson(await create(lead.id, sport.id), MeetingDto);
    const res = await call("PATCH", `/v1/meetings/${meeting.id}`, lead.id, {
      minutes: "Décidé : tournoi le 15.",
    });
    expect((await readJson(res, MeetingDto)).minutes).toBe("Décidé : tournoi le 15.");
    expect(
      (await call("PATCH", `/v1/meetings/${meeting.id}`, member.id, { minutes: "x" })).status,
    ).toBe(403);
    expect((await call("DELETE", `/v1/meetings/${meeting.id}`, lead.id)).status).toBe(204);
    expect((await call("GET", `/v1/meetings/${meeting.id}`, member.id)).status).toBe(404);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "meeting.deleted"));
    expect(audit).toHaveLength(1);
  });
});
