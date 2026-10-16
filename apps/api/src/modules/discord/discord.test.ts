import { PoleMemberDto, TaskDetailDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDisabledDiscord } from "../../lib/discord";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testDiscord, testServices } from "../../test/env";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readJson } from "../../test/http";
import { call } from "../../test/request";
import { sendTaskReminders } from "../tasks/tasks.service";
import { escapeMarkdown, eventPublishedMessage } from "./discord.messages";
import { postLateTaskRecaps } from "./discord.service";

const CHANNELS = {
  events: "100000000000000001",
  role: "900000000000000001",
  applications: "100000000000000002",
  board: "100000000000000003",
  sport: "100000000000000004",
};

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let lead: { id: string };
let board: { id: string; name: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
  board = await createPersona("board");
});

const sentTo = (channelId: string) => testDiscord.sent.filter((s) => s.channelId === channelId);
// 10:00 in Paris on 14 October 2026.
const morning = new Date("2026-10-14T08:00:00.000Z");
const deps = () => ({ db: getTestDb(), services: testServices() });

describe("Discord messages", () => {
  it("escape what people type: no formatting, no mention", () => {
    expect(escapeMarkdown("**Gala** @everyone _vite_")).toBe(
      "\\*\\*Gala\\*\\* @​everyone \\_vite\\_",
    );
  });

  it("show an event with its dates, place, poster and a link to sign up", () => {
    const message = eventPublishedMessage(
      { webOrigin: "https://bde-mingo.fr" },
      {
        slug: "gala",
        title: "Gala",
        description: "La soirée de l'année.",
        location: "Paris",
        startsAt: new Date("2026-11-12T19:00:00.000Z"),
        endsAt: new Date("2026-11-12T23:00:00.000Z"),
        posterUrl: "/uploads/gala.webp",
        pole: { name: "Événementiel" },
      },
      CHANNELS.role,
    );
    const embed = message.embeds[0];
    expect(embed?.url).toBe("https://bde-mingo.fr/events/gala");
    expect(embed?.image?.url).toBe("https://bde-mingo.fr/uploads/gala.webp");
    expect(embed?.fields?.[0]?.value).toContain("<t:1794510000:F>");
    expect(message.content).toContain(`<@&${CHANNELS.role}>`);
    expect(message.pingRoleIds).toEqual([CHANNELS.role]);
    expect(message.buttons?.[0]?.url).toBe("https://bde-mingo.fr/events/gala");
  });
});

describe("announcements", () => {
  it("post a published event in the events channel, pinging the role", async () => {
    const event = await createEvent({
      poleId: sport.id,
      title: "Tournoi de five",
      status: "draft",
    });
    const res = await call("POST", `/v1/events/${event.id}/publish`, board.id);
    expect(res.status).toBe(200);
    const [sent] = sentTo(CHANNELS.events);
    expect(sent?.message.embeds[0]?.title).toBe("Tournoi de five");
    expect(sent?.message.pingRoleIds).toEqual([CHANNELS.role]);
  });

  it("post every application in the applications channel, with the wishes", async () => {
    const student = await createPersona("student");
    await call("POST", "/v1/applications", student.id, {
      wishedPoleIds: [sport.id],
      answers: { motivation: "J'adore le sport et j'ai du temps cette année." },
    });
    const [sent] = sentTo(CHANNELS.applications);
    expect(sent?.message.embeds[0]?.title).toBe("📝 Nouvelle candidature");
    expect(sent?.message.embeds[0]?.fields?.[0]?.value).toBe("Sport");
    expect(sent?.message.buttons?.[0]?.url).toBe(
      "http://localhost:3000/manage/applications?status=new",
    );
    expect(sent?.message.pingRoleIds).toBeUndefined();
  });

  it("post tasks in their pole's channel or the bureau's, never personal ones", async () => {
    await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, { title: "Réserver le gymnase" });
    await call("POST", "/v1/board/tasks", board.id, { title: "Bilan financier" });
    // No channel for this pole: nothing posted.
    await call("POST", `/v1/poles/${com.id}/tasks`, board.id, { title: "Affiches" });
    await call("POST", "/v1/me/tasks", lead.id, { title: "Perso" });
    expect(sentTo(CHANNELS.sport).map((s) => s.message.embeds[0]?.title)).toEqual([
      "📌 Réserver le gymnase",
    ]);
    expect(sentTo(CHANNELS.board).map((s) => s.message.embeds[0]?.title)).toEqual([
      "📌 Bilan financier",
    ]);
    expect(testDiscord.sent).toHaveLength(2);
  });

  it("post a task once it is done", async () => {
    const members = await readJson(
      await call("GET", `/v1/poles/${sport.id}/members`, lead.id),
      z.array(PoleMemberDto),
    );
    const task = await readJson(
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
        title: "Réserver le gymnase",
        assigneeMembershipIds: members.map((m) => m.membershipId),
      }),
      TaskDetailDto,
    );
    testDiscord.sent.length = 0;
    await call("PATCH", `/v1/tasks/${task.id}`, lead.id, { status: "doing" });
    expect(testDiscord.sent).toHaveLength(0);
    await call("PATCH", `/v1/tasks/${task.id}`, lead.id, { status: "done" });
    expect(sentTo(CHANNELS.sport).map((s) => s.message.embeds[0]?.title)).toEqual([
      "✅ Réserver le gymnase",
    ]);
  });

  it("group the tasks due tomorrow in one message per board", async () => {
    for (const title of ["Affiches", "Ballons"]) {
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, { title, dueOn: "2026-10-15" });
    }
    await call("POST", "/v1/board/tasks", board.id, { title: "Budget", dueOn: "2026-10-15" });
    testDiscord.sent.length = 0;
    await sendTaskReminders(deps(), morning);
    const [poleMessage] = sentTo(CHANNELS.sport);
    expect(poleMessage?.message.embeds[0]?.title).toBe("⏰ À rendre demain (2)");
    expect(sentTo(CHANNELS.board)).toHaveLength(1);
    await sendTaskReminders(deps(), morning);
    expect(testDiscord.sent).toHaveLength(2);
  });

  it("recap the late tasks once a day, from 9:00", async () => {
    await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "Vieux",
      dueOn: "2026-10-01",
    });
    await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "Fini",
      dueOn: "2026-10-01",
      status: "done",
    });
    testDiscord.sent.length = 0;
    expect(await postLateTaskRecaps(deps(), new Date("2026-10-14T05:00:00.000Z"))).toBe(0);
    expect(await postLateTaskRecaps(deps(), morning)).toBe(1);
    expect(await postLateTaskRecaps(deps(), morning)).toBe(0);
    const [recap] = sentTo(CHANNELS.sport);
    expect(recap?.message.embeds[0]?.title).toBe("⚠️ Tâches en retard (1)");
    expect(recap?.message.embeds[0]?.description).toContain("Vieux");
    // The next day, a new recap.
    expect(await postLateTaskRecaps(deps(), new Date("2026-10-15T08:00:00.000Z"))).toBe(1);
  });

  it("never fail what was done on the site, and stay silent without a bot", async () => {
    const failing = {
      ...testDiscord,
      send: async () => {
        throw new Error("Discord en panne");
      },
    };
    const app = createTestApp({ discord: failing });
    const headers = await authHeaders(lead.id);
    headers.set("content-type", "application/json");
    const res = await app.request(`/v1/poles/${sport.id}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Malgré tout" }),
    });
    expect(res.status).toBe(201);

    const silent = createTestApp({ discord: createDisabledDiscord() });
    const res2 = await silent.request(`/v1/poles/${sport.id}/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Sans bot" }),
    });
    expect(res2.status).toBe(201);
    expect(testDiscord.sent).toHaveLength(0);
  });
});
