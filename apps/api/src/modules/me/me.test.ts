import { MeDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, user as userTable } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp } from "../../test/env";
import { createMembership, createPole, createSchoolYear, createUser } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

describe("GET /v1/me", () => {
  it("returns 401 without a session", async () => {
    const res = await createTestApp().request("/v1/me");
    expect(res.status).toBe(401);
    expect((await readError(res)).code).toBe("UNAUTHENTICATED");
  });

  it("returns a student with no membership", async () => {
    const user = await createUser({ name: "Camille", promo: "3A" });
    const res = await createTestApp().request("/v1/me", { headers: await authHeaders(user.id) });
    expect(res.status).toBe(200);
    expect(await readJson(res, MeDto)).toEqual({
      id: user.id,
      email: user.email,
      name: "Camille",
      firstName: "Camille",
      lastName: "",
      promo: "3A",
      image: null,
      isAdmin: false,
      memberships: [],
      roles: ["student"],
      permissions: ["events:register"],
    });
  });

  it("returns only active memberships of the current school year", async () => {
    const user = await createUser();
    const current = await createSchoolYear({ label: "2026-2027", isCurrent: true });
    const past = await createSchoolYear({
      label: "2025-2026",
      startsOn: "2025-09-01",
      endsOn: "2026-08-31",
      isCurrent: false,
    });
    const sport = await createPole({ slug: "sport", name: "Sport" });
    const com = await createPole({ slug: "communication", name: "Communication" });
    await createMembership({
      userId: user.id,
      schoolYearId: current.id,
      poleId: sport.id,
      role: "pole_lead",
    });
    await createMembership({
      userId: user.id,
      schoolYearId: current.id,
      poleId: com.id,
      role: "member",
      isActive: false,
    });
    await createMembership({ userId: user.id, schoolYearId: past.id, role: "board" });

    const res = await createTestApp().request("/v1/me", { headers: await authHeaders(user.id) });
    const me = await readJson(res, MeDto);
    expect(me.memberships).toEqual([
      {
        id: expect.any(String),
        role: "pole_lead",
        boardPosition: null,
        pole: { id: sport.id, slug: "sport", name: "Sport" },
      },
    ]);
    expect(me.roles).toEqual(["student", "member", "pole_lead"]);
    expect(me.permissions).toContain("checkin:scan");
    expect(me.permissions).not.toContain("poles:all");
  });
});

describe("PATCH /v1/me", () => {
  const audits = () =>
    getTestDb().select().from(auditLog).where(eq(auditLog.action, "user.profile_updated"));

  it("returns 401 without a session", async () => {
    const res = await call("PATCH", "/v1/me", null, { firstName: "Jeanne", lastName: "Durand" });
    expect(res.status).toBe(401);
  });

  it("rejects an empty or too long name", async () => {
    const user = await createUser();
    const empty = await call("PATCH", "/v1/me", user.id, { firstName: " ", lastName: "Durand" });
    expect(empty.status).toBe(400);
    expect((await readError(empty)).code).toBe("VALIDATION_ERROR");
    const long = await call("PATCH", "/v1/me", user.id, {
      firstName: "Jeanne",
      lastName: "x".repeat(51),
    });
    expect(long.status).toBe(400);
  });

  it("updates first and last name, recomputes name and writes the audit log", async () => {
    const user = await createUser({ name: "Jeanne Durant" });
    const res = await call("PATCH", "/v1/me", user.id, {
      firstName: " Jeanne ",
      lastName: "Durand",
    });
    expect(res.status).toBe(200);
    const me = await readJson(res, MeDto);
    expect(me).toMatchObject({ firstName: "Jeanne", lastName: "Durand", name: "Jeanne Durand" });

    const [row] = await getTestDb().select().from(userTable).where(eq(userTable.id, user.id));
    expect(row).toMatchObject({ firstName: "Jeanne", lastName: "Durand", name: "Jeanne Durand" });

    const [audit] = await audits();
    expect(audit).toMatchObject({
      actorUserId: user.id,
      entity: "user",
      entityId: user.id,
      payload: {
        before: { firstName: "Jeanne", lastName: "Durant" },
        after: { firstName: "Jeanne", lastName: "Durand" },
      },
    });
  });

  it("writes nothing when the name does not change", async () => {
    const user = await createUser({ name: "Jeanne Durand" });
    const res = await call("PATCH", "/v1/me", user.id, { firstName: "Jeanne", lastName: "Durand" });
    expect(res.status).toBe(200);
    expect(await audits()).toHaveLength(0);
  });

  it("ignores email, promo and admin flag sent in the body", async () => {
    const user = await createUser({ name: "Jeanne Durand", promo: "3A" });
    const res = await call("PATCH", "/v1/me", user.id, {
      firstName: "Jeanne",
      lastName: "Martin",
      email: "autre@myskolae.fr",
      promo: "5A",
      isAdmin: true,
    });
    expect(res.status).toBe(200);
    const [row] = await getTestDb().select().from(userTable).where(eq(userTable.id, user.id));
    expect(row).toMatchObject({
      email: user.email,
      promo: "3A",
      isAdmin: false,
      lastName: "Martin",
    });
  });
});
