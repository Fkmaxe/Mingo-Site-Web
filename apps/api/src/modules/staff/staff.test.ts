import { CheckinDto, StaffSlotDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { attendance, openPointsLedger } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

const Slots = z.array(StaffSlotDto);
type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let lead: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
});

const hours = (h: number) => new Date(Date.now() + h * 3600 * 1000);

async function eventWithSlot(
  capacity = 1,
  overrides: Parameters<typeof createEvent>[0] = { poleId: "" },
) {
  const event = await createEvent({ ...overrides, poleId: sport.id, openPointsValue: 3 });
  const res = await call("POST", `/v1/events/${event.id}/staff-slots`, lead.id, {
    label: "Bar",
    startsAt: hours(24 * 7).toISOString(),
    endsAt: hours(24 * 7 + 2).toISOString(),
    capacity,
  });
  expect(res.status).toBe(201);
  const [slot] = await readJson(res, Slots);
  if (!slot) throw new Error("créneau manquant");
  return { event, slot };
}

const slots = async (eventId: string, userId: string) =>
  readJson(await call("GET", `/v1/events/${eventId}/staff-slots`, userId), Slots);

describe("staff slots", () => {
  it("are managed by the pole lead and hidden from students", async () => {
    const { event, slot } = await eventWithSlot(2);
    expect(slot).toMatchObject({ label: "Bar", capacity: 2, validatedCount: 0, mine: null });

    const student = await createPersona("student");
    expect(await slots(event.id, student.id)).toEqual([]);
    const otherLead = await createPersona("pole_lead", { poleId: com.id });
    expect(
      (
        await call("POST", `/v1/events/${event.id}/staff-slots`, otherLead.id, {
          label: "Accueil",
          startsAt: hours(1).toISOString(),
          endsAt: hours(2).toISOString(),
          capacity: 1,
        })
      ).status,
    ).toBe(403);

    const res = await call("PATCH", `/v1/staff-slots/${slot.id}`, lead.id, { label: "Bar (soir)" });
    expect((await readJson(res, Slots))[0]?.label).toBe("Bar (soir)");
    expect((await call("DELETE", `/v1/staff-slots/${slot.id}`, lead.id)).status).toBe(204);
    expect(await slots(event.id, lead.id)).toEqual([]);
  });

  it("reject an end before the start", async () => {
    const event = await createEvent({ poleId: sport.id });
    const res = await call("POST", `/v1/events/${event.id}/staff-slots`, lead.id, {
      label: "Bar",
      startsAt: hours(5).toISOString(),
      endsAt: hours(4).toISOString(),
      capacity: 1,
    });
    expect(res.status).toBe(400);
  });
});

describe("volunteering and validation", () => {
  it("lets a member volunteer, then the lead validates within the capacity", async () => {
    const { event, slot } = await eventWithSlot(1);
    const alice = await createPersona("member", { poleId: com.id });
    const bob = await createPersona("member", { poleId: sport.id });

    for (const member of [alice, bob]) {
      const res = await call("POST", `/v1/staff-slots/${slot.id}/volunteer`, member.id);
      expect(res.status).toBe(200);
    }
    expect((await slots(event.id, alice.id))[0]?.mine?.status).toBe("proposed");
    const again = await call("POST", `/v1/staff-slots/${slot.id}/volunteer`, alice.id);
    expect((await readError(again)).code).toBe("ALREADY_VOLUNTEERED");

    const [managed] = await slots(event.id, lead.id);
    const [first, second] = managed?.assignments ?? [];
    expect(first?.pole).toBe("Communication");
    expect(
      (await call("POST", `/v1/staff-assignments/${first?.id}/validate`, lead.id)).status,
    ).toBe(200);
    const full = await call("POST", `/v1/staff-assignments/${second?.id}/validate`, lead.id);
    expect(full.status).toBe(409);
    expect((await readError(full)).code).toBe("STAFF_SLOT_FULL");
    await call("POST", `/v1/staff-assignments/${second?.id}/decline`, lead.id);

    const [after] = await slots(event.id, bob.id);
    expect([after?.validatedCount, after?.mine?.status]).toEqual([1, "declined"]);
  });

  it("is reserved to members (students get 403) and allows withdrawing", async () => {
    const { event, slot } = await eventWithSlot();
    const student = await createPersona("student");
    expect((await call("POST", `/v1/staff-slots/${slot.id}/volunteer`, student.id)).status).toBe(
      403,
    );
    const member = await createPersona("member", { poleId: com.id });
    await call("POST", `/v1/staff-slots/${slot.id}/volunteer`, member.id);
    expect((await call("POST", `/v1/staff-slots/${slot.id}/withdraw`, member.id)).status).toBe(200);
    expect((await slots(event.id, member.id))[0]?.mine).toBeNull();
  });

  it("lets the lead assign a member directly, and refuses non-members", async () => {
    const { event, slot } = await eventWithSlot();
    const member = await createPersona("member", { poleId: com.id });
    const res = await call("POST", `/v1/staff-slots/${slot.id}/assign`, lead.id, {
      userId: member.id,
    });
    expect((await readJson(res, Slots))[0]?.assignments[0]?.status).toBe("validated");
    const student = await createPersona("student");
    const refused = await call("POST", `/v1/staff-slots/${slot.id}/assign`, lead.id, {
      userId: student.id,
    });
    expect((await readError(refused)).code).toBe("NOT_A_MEMBER");
    expect((await slots(event.id, lead.id))[0]?.validatedCount).toBe(1);
  });
});

describe("staff check-in", () => {
  it("records a staff presence for validated members only, without open points", async () => {
    const { event, slot } = await eventWithSlot(2);
    const member = await createPersona("member", { poleId: sport.id });
    const other = await createPersona("member", { poleId: sport.id });
    await call("POST", `/v1/staff-slots/${slot.id}/assign`, lead.id, { userId: member.id });
    await call("POST", `/v1/staff-slots/${slot.id}/volunteer`, other.id);
    const [managed] = await slots(event.id, lead.id);
    const validated = managed?.assignments.find((a) => a.status === "validated");
    const proposed = managed?.assignments.find((a) => a.status === "proposed");

    const res = await call("POST", `/v1/staff-assignments/${validated?.id}/checkin`, lead.id);
    expect(res.status).toBe(201);
    expect((await readJson(res, CheckinDto)).kind).toBe("staff");
    expect(
      (await call("POST", `/v1/staff-assignments/${validated?.id}/checkin`, lead.id)).status,
    ).toBe(409);
    expect(
      (await call("POST", `/v1/staff-assignments/${proposed?.id}/checkin`, lead.id)).status,
    ).toBe(409);

    expect(
      (await slots(event.id, lead.id))[0]?.assignments.find((a) => a.id === validated?.id)
        ?.checkedInAt,
    ).not.toBeNull();
    const rows = await getTestDb().select().from(attendance);
    expect(rows.map((r) => r.kind)).toEqual(["staff"]);
    expect(await getTestDb().select().from(openPointsLedger)).toHaveLength(0);
  });
});
