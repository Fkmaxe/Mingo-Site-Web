import { CustomFieldsSchema, EventDto, RegistrantDto, TicketDto } from "@bde/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

let poleId: string;
let board: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole()).id;
  board = await createPersona("board");
});

const inDays = (d: number, h = 0) =>
  new Date(Date.now() + (d * 24 + h) * 3600 * 1000).toISOString();

const fields = [
  {
    key: "taille",
    label: "Taille de t-shirt",
    type: "select",
    required: true,
    options: ["S", "M", "L"],
  },
  { key: "regime", label: "Régime alimentaire", type: "text", required: false },
  { key: "reglement", label: "J'accepte le règlement", type: "checkbox", required: true },
];

async function eventWithFields() {
  return createEvent({ poleId, customFieldsSchema: CustomFieldsSchema.parse(fields) });
}

describe("custom fields on events", () => {
  it("are created with the event and exposed", async () => {
    const res = await call("POST", "/v1/events", board.id, {
      poleId,
      title: "Tournoi",
      location: "Gymnase",
      startsAt: inDays(5),
      endsAt: inDays(5, 2),
      visibility: "students",
      customFields: fields,
    });
    expect(res.status).toBe(201);
    expect((await readJson(res, EventDto)).customFields).toEqual(fields);
  });

  it("reject a select without choices", async () => {
    const res = await call("POST", "/v1/events", board.id, {
      poleId,
      title: "Tournoi",
      location: "Gymnase",
      startsAt: inDays(5),
      endsAt: inDays(5, 2),
      visibility: "students",
      customFields: [{ key: "taille", label: "Taille", type: "select", required: true }],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify((await readError(res)).details)).toContain("Indique au moins 2 choix");
  });
});

describe("registration answers", () => {
  it("are required and validated against the event's fields", async () => {
    const event = await eventWithFields();
    const student = await createPersona("student");
    const res = await call("POST", `/v1/events/${event.id}/registrations`, student.id, {
      answers: { taille: "XXL" },
    });
    expect(res.status).toBe(400);
    const error = await readError(res);
    const issues = z.object({ issues: z.array(z.object({ path: z.array(z.string()) })) });
    expect(issues.parse(error.details).issues.map((i) => i.path.join("."))).toEqual([
      "answers.taille",
      "answers.reglement",
    ]);
    // No body at all is the same as no answers.
    expect((await call("POST", `/v1/events/${event.id}/registrations`, student.id)).status).toBe(
      400,
    );
  });

  it("are stored on the ticket and shown to organisers, unknown keys dropped", async () => {
    const event = await eventWithFields();
    const student = await createPersona("student");
    const res = await call("POST", `/v1/events/${event.id}/registrations`, student.id, {
      answers: { taille: "M", reglement: true, admin: true },
    });
    expect(res.status).toBe(201);
    const ticket = await readJson(res, TicketDto);
    expect(ticket.answers).toEqual({ taille: "M", reglement: true });
    expect(ticket.questions).toEqual([
      { label: "Taille de t-shirt", answer: "M" },
      { label: "Régime alimentaire", answer: "" },
      { label: "J'accepte le règlement", answer: "Oui" },
    ]);

    const page = await readJson(
      await call("GET", `/v1/events/${event.id}/registrations`, board.id),
      z.object({ items: z.array(RegistrantDto) }),
    );
    expect(page.items[0]?.answers).toEqual({ taille: "M", reglement: true });
  });

  it("are exported as extra columns", async () => {
    const event = await eventWithFields();
    const student = await createPersona("student");
    await call("POST", `/v1/events/${event.id}/registrations`, student.id, {
      answers: { taille: "L", regime: "Végétarien", reglement: true },
    });
    const csv = await (
      await call("GET", `/v1/events/${event.id}/exports/registrations.csv`, board.id)
    ).text();
    const [header, row] = csv.trim().split("\r\n");
    expect(header?.split(";").slice(6)).toEqual([
      "Taille de t-shirt",
      "Régime alimentaire",
      "J'accepte le règlement",
    ]);
    expect(row?.split(";").slice(6)).toEqual(["L", "Végétarien", "Oui"]);
  });

  it("are optional when the event has no fields", async () => {
    const event = await createEvent({ poleId });
    const student = await createPersona("student");
    expect((await call("POST", `/v1/events/${event.id}/registrations`, student.id)).status).toBe(
      201,
    );
  });
});
