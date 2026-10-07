import { PoleMemberDto, TaskDto } from "@bde/shared";
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
let lead: { id: string };
let member: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
  member = await createPersona("member", { poleId: sport.id });
});

const members = async (poleId: string, userId: string) =>
  readJson(await call("GET", `/v1/poles/${poleId}/members`, userId), z.array(PoleMemberDto));
const tasks = async (poleId: string, userId: string) =>
  readJson(await call("GET", `/v1/poles/${poleId}/tasks`, userId), z.array(TaskDto));

async function memberMembershipId() {
  const list = await members(sport.id, lead.id);
  const found = list.find((m) => m.user.id === member.id);
  if (!found) throw new Error("membre introuvable");
  return found.membershipId;
}

describe("pole members", () => {
  it("lists members and leads of the pole for BDE members only", async () => {
    const list = await members(sport.id, member.id);
    expect(list.map((m) => [m.user.id, m.role]).sort()).toEqual(
      [
        [lead.id, "pole_lead"],
        [member.id, "member"],
      ].sort(),
    );
    const student = await createPersona("student");
    expect((await call("GET", `/v1/poles/${sport.id}/members`, student.id)).status).toBe(403);
  });
});

describe("tasks", () => {
  it("are created and assigned by the pole lead, visible to the pole", async () => {
    const res = await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "Réserver le gymnase",
      dueOn: "2026-11-15",
      assigneeMembershipId: await memberMembershipId(),
    });
    expect(res.status).toBe(201);
    expect(await readJson(res, TaskDto)).toMatchObject({
      title: "Réserver le gymnase",
      status: "todo",
      dueOn: "2026-11-15",
      assignee: { user: { id: member.id } },
      canEdit: true,
    });

    const seen = await tasks(sport.id, member.id);
    expect(seen.map((t) => [t.title, t.canEdit, t.canMove])).toEqual([
      ["Réserver le gymnase", false, true],
    ]);
    const mine = await readJson(await call("GET", "/v1/me/tasks", member.id), z.array(TaskDto));
    expect(mine).toHaveLength(1);
  });

  it("refuses assignees outside the pole and other poles' members", async () => {
    const outsider = await createPersona("member", { poleId: com.id });
    const outsiderMembership = (await members(com.id, outsider.id))[0]?.membershipId;
    const res = await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "X",
      assigneeMembershipId: outsiderMembership,
    });
    expect(res.status).toBe(400);
    expect((await call("GET", `/v1/poles/${sport.id}/tasks`, outsider.id)).status).toBe(403);
    expect(
      (await call("POST", `/v1/poles/${sport.id}/tasks`, member.id, { title: "X" })).status,
    ).toBe(403);
  });

  it("lets the assignee move the status only", async () => {
    const created = await readJson(
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
        title: "Affiche",
        assigneeMembershipId: await memberMembershipId(),
      }),
      TaskDto,
    );
    const moved = await call("PATCH", `/v1/tasks/${created.id}`, member.id, { status: "doing" });
    expect((await readJson(moved, TaskDto)).status).toBe("doing");
    const renamed = await call("PATCH", `/v1/tasks/${created.id}`, member.id, { title: "Hack" });
    expect(renamed.status).toBe(403);

    const other = await createPersona("member", { poleId: sport.id });
    expect(
      (await call("PATCH", `/v1/tasks/${created.id}`, other.id, { status: "done" })).status,
    ).toBe(403);
  });

  it("orders open tasks first and soft-deletes with an audit entry", async () => {
    for (const [title, status] of [
      ["Fini", "done"],
      ["A faire", "todo"],
      ["En cours", "doing"],
    ] as const) {
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, { title, status });
    }
    const list = await tasks(sport.id, lead.id);
    expect(list.map((t) => t.title)).toEqual(["En cours", "A faire", "Fini"]);

    const target = list[0];
    expect((await call("DELETE", `/v1/tasks/${target?.id}`, member.id)).status).toBe(403);
    expect((await call("DELETE", `/v1/tasks/${target?.id}`, lead.id)).status).toBe(204);
    expect((await tasks(sport.id, lead.id)).map((t) => t.title)).toEqual(["A faire", "Fini"]);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "task.deleted"));
    expect(audit).toHaveLength(1);
    const gone = await call("PATCH", `/v1/tasks/${target?.id}`, lead.id, { status: "done" });
    expect((await readError(gone)).code).toBe("NOT_FOUND");
  });

  it("lets the board manage every pole", async () => {
    const board = await createPersona("board");
    expect(
      (await call("POST", `/v1/poles/${com.id}/tasks`, board.id, { title: "Flyers" })).status,
    ).toBe(201);
    expect(await tasks(com.id, board.id)).toHaveLength(1);
  });
});
