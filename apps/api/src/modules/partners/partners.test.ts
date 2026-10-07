import { MemberDirectoryEntryDto, PartnerDto, PublicPartnerDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

let board: { id: string };
let member: { id: string };
let sportId: string;

beforeEach(async () => {
  await createSchoolYear();
  sportId = (await createPole({ slug: "sport", name: "Sport" })).id;
  board = await createPersona("board");
  member = await createPersona("member", { poleId: sportId });
});

const directory = async (userId: string) =>
  readJson(await call("GET", "/v1/members", userId), z.array(MemberDirectoryEntryDto));

describe("member directory", () => {
  it("lists the board first, then members by pole, for members only", async () => {
    const entries = await directory(member.id);
    expect(entries.map((e) => [e.role, e.pole?.name ?? null])).toEqual([
      ["board", null],
      ["member", "Sport"],
    ]);
    expect(entries[1]?.user.email).toContain("@myskolae.fr");
    const student = await createPersona("student");
    expect((await call("GET", "/v1/members", student.id)).status).toBe(403);
  });
});

describe("partners", () => {
  async function createPartner(extra: Record<string, unknown> = {}) {
    const res = await call("POST", "/v1/partners", board.id, {
      name: "Salle de sport Vitalis",
      website: "https://vitalis.example",
      contactName: "Mme Martin",
      contactEmail: "contact@vitalis.example",
      benefits: "-20 % sur l'abonnement",
      notes: "Rappeler en janvier",
      ...extra,
    });
    expect(res.status).toBe(201);
    return readJson(res, PartnerDto);
  }

  it("shows only active partners publicly, without contacts or notes", async () => {
    const prospect = await createPartner();
    expect(prospect.status).toBe("prospect");
    await call("PATCH", `/v1/partners/${prospect.id}`, board.id, { status: "active" });
    await createPartner({ name: "Autre prospect" });

    const res = await call("GET", "/v1/partners/public");
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("Mme Martin");
    expect(JSON.stringify(body)).not.toContain("Rappeler");
    expect(z.array(PublicPartnerDto).parse(body)).toEqual([
      {
        id: prospect.id,
        name: "Salle de sport Vitalis",
        website: "https://vitalis.example",
        benefits: "-20 % sur l'abonnement",
      },
    ]);
  });

  it("lets the referent edit their partner, but only the board reassigns or creates", async () => {
    const [entry] = (await directory(board.id)).filter((e) => e.user.id === member.id);
    const created = await createPartner({ ownerMembershipId: entry?.membershipId });
    expect(created.owner?.name).toBeDefined();

    const asMember = await readJson(
      await call("GET", `/v1/partners/${created.id}`, member.id),
      PartnerDto,
    );
    expect(asMember.canEdit).toBe(true);
    const res = await call("PATCH", `/v1/partners/${created.id}`, member.id, {
      status: "negotiating",
    });
    expect((await readJson(res, PartnerDto)).status).toBe("negotiating");
    const reassign = await call("PATCH", `/v1/partners/${created.id}`, member.id, {
      ownerMembershipId: null,
    });
    expect(reassign.status).toBe(403);

    const other = await createPersona("member", { poleId: sportId });
    expect(
      (await call("PATCH", `/v1/partners/${created.id}`, other.id, { notes: "x" })).status,
    ).toBe(403);
    expect((await call("POST", "/v1/partners", member.id, { name: "X" })).status).toBe(403);
  });

  it("refuses a referent who is not a member and soft-deletes with an audit entry", async () => {
    const res = await call("POST", "/v1/partners", board.id, {
      name: "X",
      ownerMembershipId: "00000000-0000-4000-8000-000000000000",
    });
    expect((await readError(res)).code).toBe("VALIDATION_ERROR");

    const created = await createPartner();
    expect((await call("DELETE", `/v1/partners/${created.id}`, board.id)).status).toBe(204);
    expect((await call("GET", `/v1/partners/${created.id}`, board.id)).status).toBe(404);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "partner.deleted"));
    expect(audit).toHaveLength(1);
  });
});
