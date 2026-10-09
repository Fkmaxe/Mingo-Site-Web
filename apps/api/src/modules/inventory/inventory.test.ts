import { ItemDto, LocationDto, MovementDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testPhotos } from "../../test/env";
import { createEvent, createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type User = Awaited<ReturnType<typeof createPersona>>;
let member: User;
let lead: User;
let poleId: string;

beforeEach(async () => {
  await createSchoolYear();
  poleId = (await createPole({ name: "Événementiel" })).id;
  member = await createPersona("member", { poleId });
  lead = await createPersona("pole_lead", { poleId });
});

const Page = z.object({ items: z.array(MovementDto), nextCursor: z.string().nullable() });

async function addItem(body: Record<string, unknown>, as: User = member) {
  const res = await call("POST", "/v1/inventory/items", as.id, body);
  expect(res.status).toBe(201);
  return readJson(res, ItemDto);
}

async function history(itemId: string) {
  const page = await readJson(
    await call("GET", `/v1/inventory/history?itemId=${itemId}`, member.id),
    Page,
  );
  return page.items.map((m) => m.action);
}

async function location(name: string) {
  const list = await readJson(
    await call("POST", "/v1/inventory/locations", member.id, { name }),
    z.array(LocationDto),
  );
  const found = list.find((l) => l.name === name);
  if (!found) throw new Error("location");
  return found.id;
}

describe("access", () => {
  it("is for BDE members; students and visitors are refused", async () => {
    const student = await createPersona("student");
    expect((await call("GET", "/v1/inventory/items", null)).status).toBe(401);
    expect((await call("GET", "/v1/inventory/items", student.id)).status).toBe(403);
    expect((await call("GET", "/v1/inventory/items", member.id)).status).toBe(200);
  });
});

describe("items", () => {
  it("adds an item with only a name, gives it a label code, records it", async () => {
    const item = await addItem({ name: "Enceinte JBL" });
    expect(item).toMatchObject({
      name: "Enceinte JBL",
      kind: "unique",
      quantity: 1,
      available: 1,
      condition: "good",
      location: null,
    });
    expect(item.code).toMatch(/^INV-\d{4}$/);
    expect(await history(item.id)).toEqual(["created"]);
  });

  it("finds an item by name, category or its label code", async () => {
    const speaker = await addItem({ name: "Enceinte", category: "Son" });
    await addItem({ name: "Barnum 3x3", category: "Extérieur" });
    const search = async (q: string) =>
      (
        await readJson(
          await call("GET", `/v1/inventory/items?q=${encodeURIComponent(q)}`, member.id),
          z.array(ItemDto),
        )
      ).map((i) => i.name);
    expect(await search("son")).toEqual(["Enceinte"]);
    expect(await search(speaker.code.toLowerCase())).toEqual(["Enceinte"]);
  });

  it("records a move and a state change as their own history entries", async () => {
    const local = await location("Local BDE");
    const cave = await location("Cave");
    const item = await addItem({ name: "Barnum", locationId: local });
    const moved = await readJson(
      await call("PATCH", `/v1/inventory/items/${item.id}`, member.id, {
        locationId: cave,
        condition: "damaged",
        note: "Une baleine cassée",
      }),
      ItemDto,
    );
    expect(moved).toMatchObject({ location: { name: "Cave" }, condition: "damaged" });
    const page = await readJson(
      await call("GET", `/v1/inventory/history?itemId=${item.id}`, member.id),
      Page,
    );
    const move = page.items.find((m) => m.action === "moved");
    expect(move).toMatchObject({
      details: { from: "Local BDE", to: "Cave" },
      note: "Une baleine cassée",
      actor: { id: member.id },
    });
    expect(page.items.map((m) => m.action).sort()).toEqual(
      ["condition_changed", "created", "moved"].sort(),
    );
  });

  it("validates: a unique item has a quantity of 1, a location must exist", async () => {
    const tooMany = await call("POST", "/v1/inventory/items", member.id, {
      name: "Enceinte",
      quantity: 3,
    });
    expect(tooMany.status).toBe(400);
    const unknown = await call("POST", "/v1/inventory/items", member.id, {
      name: "Enceinte",
      locationId: "00000000-0000-4000-8000-000000000000",
    });
    expect(unknown.status).toBe(404);
  });

  it("refuses a location name used twice, whatever the case", async () => {
    await location("Local BDE");
    const res = await call("POST", "/v1/inventory/locations", member.id, { name: "local bde" });
    expect((await readError(res)).code).toBe("ALREADY_EXISTS");
  });
});

describe("stock", () => {
  it("adjusts a stock in + and -, never below what is out", async () => {
    const cups = await addItem({ name: "Gobelets", kind: "stock", quantity: 100 });
    const more = await readJson(
      await call("POST", `/v1/inventory/items/${cups.id}/adjust`, member.id, {
        delta: 50,
        note: "Commande",
      }),
      ItemDto,
    );
    expect(more.quantity).toBe(150);
    await call("POST", `/v1/inventory/items/${cups.id}/checkouts`, member.id, {
      quantity: 120,
      holder: "Soirée d'intégration",
    });
    const refused = await call("POST", `/v1/inventory/items/${cups.id}/adjust`, member.id, {
      delta: -40,
    });
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("NOT_AVAILABLE");
  });

  it("refuses adjusting a unique item", async () => {
    const speaker = await addItem({ name: "Enceinte" });
    const res = await call("POST", `/v1/inventory/items/${speaker.id}/adjust`, member.id, {
      delta: 1,
    });
    expect(res.status).toBe(400);
  });
});

describe("taking out and returning", () => {
  it("takes a unique item out once, flags it overdue, returns it with its state", async () => {
    const event = await createEvent({ poleId, title: "Gala" });
    const speaker = await addItem({ name: "Enceinte" });
    const out = await readJson(
      await call("POST", `/v1/inventory/items/${speaker.id}/checkouts`, member.id, {
        holder: "Léa (pôle event)",
        eventId: event.id,
        dueAt: new Date(Date.now() - 3600_000).toISOString(),
      }),
      ItemDto,
    );
    expect(out).toMatchObject({ available: 0, overdue: true });
    expect(out.checkouts).toMatchObject([{ holder: "Léa (pôle event)", event: { title: "Gala" } }]);

    const twice = await call("POST", `/v1/inventory/items/${speaker.id}/checkouts`, member.id, {
      holder: "Quelqu'un d'autre",
    });
    expect((await readError(twice)).code).toBe("NOT_AVAILABLE");

    const overdue = await readJson(
      await call("GET", "/v1/inventory/items?status=overdue", member.id),
      z.array(ItemDto),
    );
    expect(overdue.map((i) => i.id)).toEqual([speaker.id]);

    const back = await readJson(
      await call("POST", `/v1/inventory/checkouts/${out.checkouts[0]?.id}/return`, member.id, {
        condition: "worn",
        note: "Grésille un peu",
      }),
      ItemDto,
    );
    expect(back).toMatchObject({ available: 1, overdue: false, checkouts: [], condition: "worn" });
    expect(await history(speaker.id)).toEqual([
      "condition_changed",
      "returned",
      "checked_out",
      "created",
    ]);

    const again = await call(
      "POST",
      `/v1/inventory/checkouts/${out.checkouts[0]?.id}/return`,
      member.id,
      { condition: "good" },
    );
    expect(again.status).toBe(409);
  });

  it("takes part of a stock out, up to what is left", async () => {
    const cups = await addItem({ name: "Gobelets", kind: "stock", quantity: 50 });
    const out = await readJson(
      await call("POST", `/v1/inventory/items/${cups.id}/checkouts`, member.id, {
        quantity: 30,
        holder: "Bar",
      }),
      ItemDto,
    );
    expect(out.available).toBe(20);
    const tooMuch = await call("POST", `/v1/inventory/items/${cups.id}/checkouts`, member.id, {
      quantity: 21,
      holder: "Bar 2",
    });
    expect((await readError(tooMuch)).message).toBe("Seulement 20 disponibles.");
  });
});

describe("archive", () => {
  it("is for pole leads and the board, refused while out, audited, restorable", async () => {
    const speaker = await addItem({ name: "Enceinte" });
    expect(
      (await call("POST", `/v1/inventory/items/${speaker.id}/archive`, member.id, {})).status,
    ).toBe(403);

    const out = await readJson(
      await call("POST", `/v1/inventory/items/${speaker.id}/checkouts`, member.id, {
        holder: "Léa",
      }),
      ItemDto,
    );
    const whileOut = await call("POST", `/v1/inventory/items/${speaker.id}/archive`, lead.id, {});
    expect(whileOut.status).toBe(409);
    await call("POST", `/v1/inventory/checkouts/${out.checkouts[0]?.id}/return`, member.id, {
      condition: "broken",
    });

    const archived = await readJson(
      await call("POST", `/v1/inventory/items/${speaker.id}/archive`, lead.id, {
        note: "HS, jetée",
      }),
      ItemDto,
    );
    expect(archived.archivedAt).not.toBeNull();
    const list = await readJson(
      await call("GET", "/v1/inventory/items", member.id),
      z.array(ItemDto),
    );
    expect(list).toHaveLength(0);
    const edit = await call("PATCH", `/v1/inventory/items/${speaker.id}`, member.id, {
      name: "x",
    });
    expect(edit.status).toBe(409);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "inventory.archived"));
    expect(audit).toHaveLength(1);

    await call("POST", `/v1/inventory/items/${speaker.id}/restore`, lead.id);
    expect(await history(speaker.id)).toContain("restored");
  });
});

describe("photos", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

  async function upload(itemId: string, bytes: Uint8Array, type = "image/jpeg") {
    const headers = await authHeaders(member.id);
    headers.set("content-type", type);
    return createTestApp().request(`/v1/inventory/items/${itemId}/photo`, {
      method: "PUT",
      headers,
      body: bytes,
    });
  }

  it("stores a photo, serves it to members, replaces the old file", async () => {
    const item = await addItem({ name: "Enceinte" });
    const first = await readJson(await upload(item.id, JPEG), ItemDto);
    expect(first.photoUrl).toMatch(/^\/inventory\/photos\/[0-9a-f-]+\.jpg$/);
    const name = first.photoUrl?.split("/").pop() ?? "";
    const served = await call("GET", `/v1/inventory/photos/${name}`, member.id);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(JPEG);
    const student = await createPersona("student");
    expect((await call("GET", `/v1/inventory/photos/${name}`, student.id)).status).toBe(403);

    await upload(item.id, JPEG);
    expect(testPhotos.files.has(name)).toBe(false);
    expect(await history(item.id)).toEqual(["photo_changed", "photo_changed", "created"]);
  });

  it("refuses what is not an image, whatever the announced type", async () => {
    const item = await addItem({ name: "Enceinte" });
    const res = await upload(item.id, new TextEncoder().encode("<svg onload=alert(1)>"));
    expect(res.status).toBe(400);
  });

  it("refuses a photo over 3 MB", async () => {
    const item = await addItem({ name: "Enceinte" });
    const big = new Uint8Array(3 * 1024 * 1024 + 200 * 1024);
    big.set(JPEG);
    expect([400, 413]).toContain((await upload(item.id, big)).status);
  });
});

describe("history", () => {
  it("lists every action of the inventory, latest first, page by page", async () => {
    await addItem({ name: "A" });
    await addItem({ name: "B" });
    await addItem({ name: "C" });
    const first = await readJson(
      await call("GET", "/v1/inventory/history?limit=2", member.id),
      Page,
    );
    expect(first.items.map((m) => m.item.name)).toEqual(["C", "B"]);
    const rest = await readJson(
      await call("GET", `/v1/inventory/history?limit=2&cursor=${first.nextCursor}`, member.id),
      Page,
    );
    expect(rest.items.map((m) => m.item.name)).toEqual(["A"]);
  });
});
