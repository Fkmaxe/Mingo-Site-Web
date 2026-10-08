import { StaffSlotDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { getTestDb } from "../test/db";
import { testMailer, testNotifier, testPusher } from "../test/env";
import {
  createEvent,
  createPersona,
  createPole,
  createSchoolYear,
  createUser,
} from "../test/factories";
import { readJson } from "../test/http";
import { call } from "../test/request";
import { runReminders } from "./reminders";

const deps = () => ({
  db: getTestDb(),
  services: {
    mailer: testMailer,
    pusher: testPusher,
    notifier: testNotifier,
    webOrigin: "http://localhost:3000",
  },
});
const hours = (h: number) => new Date(Date.now() + h * 3600 * 1000);

let poleId: string;

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole()).id;
});

async function register(eventId: string, email: string) {
  const student = await createUser({ email });
  const ticket = await readJson(
    await call("POST", `/v1/events/${eventId}/registrations`, student.id),
    TicketDto,
  );
  return { student, ticket };
}

describe("day-before reminders", () => {
  it("are sent once to confirmed participants of events starting within 24 hours", async () => {
    const tomorrow = await createEvent({
      poleId,
      title: "Gala",
      startsAt: hours(20),
      endsAt: hours(23),
    });
    const later = await createEvent({ poleId, startsAt: hours(50), endsAt: hours(52) });
    const { ticket } = await register(tomorrow.id, "a@myskolae.fr");
    await register(later.id, "b@myskolae.fr");
    const leaving = await register(tomorrow.id, "c@myskolae.fr");
    await call("POST", `/v1/registrations/${leaving.ticket.id}/cancel`, leaving.student.id);
    testMailer.sent.length = 0;

    expect(await runReminders(deps())).toEqual({ participants: 1, staff: 0 });
    expect(testMailer.sent.map((m) => m.to)).toEqual(["a@myskolae.fr"]);
    expect(testMailer.lastTo("a@myskolae.fr")?.text).toContain(`/tickets/${ticket.id}`);

    testMailer.sent.length = 0;
    expect(await runReminders(deps())).toEqual({ participants: 0, staff: 0 });
    expect(testMailer.sent).toHaveLength(0);
  });

  it("are sent once to validated staff of slots starting within 24 hours", async () => {
    const event = await createEvent({
      poleId,
      title: "Gala",
      startsAt: hours(20),
      endsAt: hours(26),
    });
    const lead = await createPersona("pole_lead", { poleId });
    const member = await createPersona("member", { poleId });
    const proposed = await createPersona("member", { poleId });
    const [slot] = await readJson(
      await call("POST", `/v1/events/${event.id}/staff-slots`, lead.id, {
        label: "Bar",
        startsAt: hours(19).toISOString(),
        endsAt: hours(21).toISOString(),
        capacity: 2,
      }),
      z.array(StaffSlotDto),
    );
    await call("POST", `/v1/staff-slots/${slot?.id}/assign`, lead.id, { userId: member.id });
    expect(testMailer.lastTo(member.email)?.subject).toBe("Tu es dans le staff : Gala");
    await call("POST", `/v1/staff-slots/${slot?.id}/volunteer`, proposed.id);
    testMailer.sent.length = 0;

    expect((await runReminders(deps())).staff).toBe(1);
    expect(testMailer.lastTo(member.email)?.subject).toBe("Rappel staff : Gala");
    expect((await runReminders(deps())).staff).toBe(0);
  });
});
