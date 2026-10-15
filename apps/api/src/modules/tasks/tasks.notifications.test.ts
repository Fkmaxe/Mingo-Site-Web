import { PoleMemberDto, TaskDetailDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { getTestDb } from "../../test/db";
import { testMailer, testNotifier, testPusher } from "../../test/env";
import { createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readJson } from "../../test/http";
import { call } from "../../test/request";
import { sendTaskReminders } from "./tasks.service";

let poleId: string;
let lead: { id: string; email: string };
let member: { id: string; email: string };
let membershipOf: (userId: string) => string;

const deps = () => ({
  db: getTestDb(),
  services: {
    mailer: testMailer,
    pusher: testPusher,
    notifier: testNotifier,
    webOrigin: "http://localhost:3000",
  },
});

async function subscribe(userId: string) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${userId}`;
  await call("POST", "/v1/me/push/subscriptions", userId, {
    endpoint,
    keys: { p256dh: "BPublicKeyOfTheBrowser", auth: "authSecret" },
    newEvents: false,
  });
  return endpoint;
}

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole()).id;
  lead = await createPersona("pole_lead", { poleId });
  member = await createPersona("member", { poleId });
  const list = await readJson(
    await call("GET", `/v1/poles/${poleId}/members`, lead.id),
    z.array(PoleMemberDto),
  );
  membershipOf = (userId) => list.find((m) => m.user.id === userId)?.membershipId ?? "";
});

const create = async (body: Record<string, unknown>) =>
  readJson(
    await call("POST", `/v1/poles/${poleId}/tasks`, lead.id, { title: "Affiches", ...body }),
    TaskDetailDto,
  );

describe("assignment notifications", () => {
  it("mail and push the people put on a task, never the one who did it", async () => {
    const endpoint = await subscribe(member.id);
    const own = await subscribe(lead.id);
    const task = await create({
      dueOn: "2026-11-15",
      assigneeMembershipIds: [membershipOf(member.id), membershipOf(lead.id)],
    });

    expect(testMailer.sent.map((m) => [m.to, m.subject])).toEqual([
      [member.email, "Nouvelle tâche : Affiches"],
    ]);
    expect(testMailer.sent[0]?.text).toContain("15/11/2026");
    expect(testPusher.sent.map((s) => [s.endpoint, s.message.url])).toEqual([
      [endpoint, `/tasks/${task.id}`],
    ]);
    expect(testPusher.sent.some((s) => s.endpoint === own)).toBe(false);

    // Only the people added by an edit are told.
    testMailer.sent.length = 0;
    const third = await createPersona("member", { poleId });
    const list = await readJson(
      await call("GET", `/v1/poles/${poleId}/members`, lead.id),
      z.array(PoleMemberDto),
    );
    const thirdId = list.find((m) => m.user.id === third.id)?.membershipId;
    await call("PATCH", `/v1/tasks/${task.id}`, lead.id, {
      assigneeMembershipIds: [membershipOf(member.id), thirdId],
    });
    expect(testMailer.sent.map((m) => m.to)).toEqual([third.email]);
  });
});

describe("deadline reminders", () => {
  // 10:00 in Paris on 14 October 2026 (UTC+2).
  const morning = new Date("2026-10-14T08:00:00.000Z");

  it("are sent the day before from 9:00, once per deadline, to assignees", async () => {
    const endpoint = await subscribe(member.id);
    const task = await create({
      dueOn: "2026-10-15",
      assigneeMembershipIds: [membershipOf(member.id)],
    });
    await create({ title: "Plus tard", dueOn: "2026-10-20" });
    await create({ title: "Finie", dueOn: "2026-10-15", status: "done" });
    testMailer.sent.length = 0;
    testPusher.sent.length = 0;

    expect(await sendTaskReminders(deps(), new Date("2026-10-14T05:00:00.000Z"))).toBe(0);
    expect(await sendTaskReminders(deps(), morning)).toBe(1);
    expect(testMailer.sent.map((m) => [m.to, m.subject])).toEqual([
      [member.email, "C'est pour demain : Affiches"],
    ]);
    expect(testPusher.sent.map((s) => s.endpoint)).toEqual([endpoint]);
    expect(await sendTaskReminders(deps(), morning)).toBe(0);

    // A new deadline gets its own reminder.
    await call("PATCH", `/v1/tasks/${task.id}`, lead.id, { dueOn: "2026-10-16" });
    expect(await sendTaskReminders(deps(), new Date("2026-10-15T08:00:00.000Z"))).toBe(1);
  });

  it("go to the author of a personal task", async () => {
    await call("POST", "/v1/me/tasks", member.id, { title: "Réviser", dueOn: "2026-10-15" });
    testMailer.sent.length = 0;
    expect(await sendTaskReminders(deps(), morning)).toBe(1);
    expect(testMailer.sent.map((m) => m.to)).toEqual([member.email]);
  });
});
