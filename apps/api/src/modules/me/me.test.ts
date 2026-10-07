import { MeDto } from "@bde/shared";
import { describe, expect, it } from "vitest";
import { authHeaders } from "../../test/auth";
import { createTestApp } from "../../test/env";
import { createMembership, createPole, createSchoolYear, createUser } from "../../test/factories";
import { readError, readJson } from "../../test/http";

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
