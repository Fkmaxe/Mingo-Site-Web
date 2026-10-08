import { PushConfigDto, PushStatusDto, TicketDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushSubscription } from "../../db/schema";
import { runReminders } from "../../jobs/reminders";
import { getTestDb } from "../../test/db";
import { testMailer, testNotifier, testPusher } from "../../test/env";
import {
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

let poleId: string;

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole({ slug: "sport", name: "Sport" })).id;
});

const hours = (h: number) => new Date(Date.now() + h * 3600 * 1000);
let devices = 0;

async function subscribe(userId: string, options: { newEvents?: boolean; endpoint?: string } = {}) {
  devices += 1;
  const endpoint = options.endpoint ?? `https://fcm.googleapis.com/fcm/send/device-${devices}`;
  const res = await call("POST", "/v1/me/push/subscriptions", userId, {
    endpoint,
    keys: { p256dh: "BPublicKeyOfTheBrowser", auth: "authSecret" },
    newEvents: options.newEvents ?? true,
  });
  expect(res.status).toBe(200);
  return endpoint;
}

const sentTo = (endpoint: string) => testPusher.sent.filter((s) => s.endpoint === endpoint);

describe("push subscriptions", () => {
  it("gives the VAPID public key to signed-in users only", async () => {
    expect((await call("GET", "/v1/push/config", null)).status).toBe(401);
    const user = await createUser();
    const config = await readJson(await call("GET", "/v1/push/config", user.id), PushConfigDto);
    expect(config.publicKey).toBe("test-public-key");
  });

  it("subscribes, sets the preference and unsubscribes a device", async () => {
    const user = await createUser();
    const endpoint = await subscribe(user.id);
    await subscribe(user.id);
    const status = await readJson(await call("GET", "/v1/me/push", user.id), PushStatusDto);
    expect(status).toEqual({ devices: 2, newEvents: true });

    const off = await readJson(
      await call("PATCH", "/v1/me/push", user.id, { newEvents: false }),
      PushStatusDto,
    );
    expect(off.newEvents).toBe(false);

    const after = await readJson(
      await call("POST", "/v1/me/push/unsubscribe", user.id, { endpoint }),
      PushStatusDto,
    );
    expect(after.devices).toBe(1);
  });

  it("moves a browser's endpoint to the account now using it", async () => {
    const first = await createUser();
    const second = await createUser();
    const endpoint = await subscribe(first.id);
    await subscribe(second.id, { endpoint });
    const rows = await getTestDb()
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint));
    expect(rows.map((r) => r.userId)).toEqual([second.id]);
  });

  it("validates the subscription", async () => {
    const user = await createUser();
    const res = await call("POST", "/v1/me/push/subscriptions", user.id, {
      endpoint: "pas une url",
      keys: { p256dh: "", auth: "x" },
    });
    expect(res.status).toBe(400);
    expect((await readError(res)).code).toBe("VALIDATION_ERROR");
  });

  it("refuses an endpoint outside the known push services (SSRF)", async () => {
    const user = await createUser();
    const res = await call("POST", "/v1/me/push/subscriptions", user.id, {
      endpoint: "https://internal.example/admin",
      keys: { p256dh: "BPublicKeyOfTheBrowser", auth: "authSecret" },
    });
    expect(res.status).toBe(400);
  });
});

describe("personal notifications", () => {
  it("tells a waitlisted person that a place was freed, and drops revoked devices", async () => {
    const event = await createEvent({ poleId, title: "Gala", capacity: 1 });
    const first = await createUser();
    const second = await createUser();
    const ticket = await readJson(
      await call("POST", `/v1/events/${event.id}/registrations`, first.id),
      TicketDto,
    );
    const waiting = await readJson(
      await call("POST", `/v1/events/${event.id}/registrations`, second.id),
      TicketDto,
    );
    const phone = await subscribe(second.id);
    const oldLaptop = await subscribe(second.id);
    testPusher.gone.add(oldLaptop);

    await call("POST", `/v1/registrations/${ticket.id}/cancel`, first.id);
    expect(sentTo(phone).map((s) => s.message)).toEqual([
      expect.objectContaining({
        title: "Une place s'est libérée 🎉",
        url: `/tickets/${waiting.id}`,
      }),
    ]);
    const left = await getTestDb()
      .select({ endpoint: pushSubscription.endpoint })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, second.id));
    expect(left.map((r) => r.endpoint)).toEqual([phone]);
  });

  it("tells registrants that the event is cancelled", async () => {
    const event = await createEvent({ poleId, title: "Gala" });
    const student = await createUser();
    await call("POST", `/v1/events/${event.id}/registrations`, student.id);
    const phone = await subscribe(student.id);
    const board = await createPersona("board");
    expect((await call("POST", `/v1/events/${event.id}/cancel`, board.id)).status).toBe(200);
    expect(sentTo(phone)[0]?.message).toMatchObject({ title: "Événement annulé" });
  });

  it("sends the day-before reminder", async () => {
    const event = await createEvent({
      poleId,
      title: "Gala",
      startsAt: hours(20),
      endsAt: hours(23),
    });
    const student = await createUser();
    await call("POST", `/v1/events/${event.id}/registrations`, student.id);
    const phone = await subscribe(student.id);
    await runReminders({
      db: getTestDb(),
      services: {
        mailer: testMailer,
        pusher: testPusher,
        notifier: testNotifier,
        webOrigin: "http://localhost:3000",
      },
    });
    expect(sentTo(phone)[0]?.message.title).toBe("C'est demain : Gala");
  });
});

describe("new event announcements", () => {
  it("announces a published event to opted-in devices, not to its publisher", async () => {
    const board = await createPersona("board");
    const fan = await createUser();
    const quiet = await createUser();
    const fanPhone = await subscribe(fan.id);
    const quietPhone = await subscribe(quiet.id, { newEvents: false });
    const boardPhone = await subscribe(board.id);
    const draft = await createEvent({ poleId, title: "Tournoi", status: "draft" });

    expect((await call("POST", `/v1/events/${draft.id}/publish`, board.id)).status).toBe(200);
    // Sent in the background, after the response.
    await vi.waitFor(() => expect(sentTo(fanPhone)).toHaveLength(1));
    expect(sentTo(fanPhone)[0]?.message).toMatchObject({
      title: "Nouvel événement : Tournoi",
      url: `/events/${draft.slug}`,
    });
    expect(sentTo(quietPhone)).toHaveLength(0);
    expect(sentTo(boardPhone)).toHaveLength(0);
  });

  it("announces a members-only event to members only", async () => {
    const board = await createPersona("board");
    const member = await createPersona("member", { poleId });
    const student = await createUser();
    const memberPhone = await subscribe(member.id);
    const studentPhone = await subscribe(student.id);
    const draft = await createEvent({ poleId, status: "draft", visibility: "members" });

    await call("POST", `/v1/events/${draft.id}/publish`, board.id);
    await vi.waitFor(() => expect(sentTo(memberPhone)).toHaveLength(1));
    expect(sentTo(studentPhone)).toHaveLength(0);
  });
});
