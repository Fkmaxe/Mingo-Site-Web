import { PERMISSIONS, type Permission } from "@bde/shared";
import { createRoute, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp } from "../../test/env";
import { createMembership, createPole, createSchoolYear, createUser } from "../../test/factories";
import { readError } from "../../test/http";
import { AppError } from "../errors";
import { assertPoleAccess, loadAuthorization, requirePermission } from "./permissions";
import type { ActiveMembership } from "./roles";

describe("assertPoleAccess", () => {
  const lead: ActiveMembership = { poleId: "sport", role: "pole_lead", boardPosition: null };
  const member: ActiveMembership = { poleId: "sport", role: "member", boardPosition: null };
  const ctx = (permissions: Permission[], memberships: ActiveMembership[] = [lead]) => ({
    permissions: new Set(permissions),
    memberships,
  });

  it("lets anyone with poles:all act on any pole", () => {
    expect(() => assertPoleAccess(ctx(["poles:all"], []), "com")).not.toThrow();
  });

  it("lets a pole lead act on their pole", () => {
    expect(() => assertPoleAccess(ctx([]), "sport")).not.toThrow();
  });

  it("refuses a pole lead on another pole", () => {
    expect(() => assertPoleAccess(ctx([]), "com")).toThrow(AppError);
  });

  it("refuses a simple member of the pole", () => {
    expect(() => assertPoleAccess(ctx([], [member]), "sport")).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });
});

describe("loadAuthorization", () => {
  it("reads permissions of the effective roles from role_permission", async () => {
    const user = await createUser();
    const year = await createSchoolYear();
    await createMembership({
      userId: user.id,
      schoolYearId: year.id,
      role: "board",
      boardPosition: "treasurer",
    });
    const auth = await loadAuthorization(getTestDb(), user.id);
    expect(auth.roles).toEqual(["student", "member", "board", "treasurer"]);
    expect(auth.permissions.has("budget:manage")).toBe(true);
    expect(auth.permissions.has("poles:all")).toBe(true);
    expect(auth.permissions.has("roles:manage")).toBe(false);
  });

  it("treats a member of a past school year as a student", async () => {
    const user = await createUser();
    const pole = await createPole();
    const past = await createSchoolYear({ isCurrent: false });
    await createMembership({
      userId: user.id,
      schoolYearId: past.id,
      role: "pole_lead",
      poleId: pole.id,
    });
    const auth = await loadAuthorization(getTestDb(), user.id);
    expect(auth.roles).toEqual(["student"]);
    expect([...auth.permissions]).toEqual(["events:register"]);
  });

  it("gives the site administrator every permission", async () => {
    const admin = await createUser({ isAdmin: true });
    const auth = await loadAuthorization(getTestDb(), admin.id);
    expect(auth.roles).toContain("admin");
    expect([...auth.permissions].sort()).toEqual([...PERMISSIONS].sort());
  });
});

describe("requirePermission", () => {
  function appWithProtectedRoute() {
    const app = createTestApp();
    app.openapi(
      createRoute({
        method: "get",
        path: "/v1/test/exports",
        middleware: [requirePermission("exports:run")] as const,
        responses: {
          200: {
            content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
            description: "ok",
          },
        },
      }),
      (c) => c.json({ ok: true }, 200),
    );
    return app;
  }

  it("returns 401 without a session", async () => {
    const res = await appWithProtectedRoute().request("/v1/test/exports");
    expect(res.status).toBe(401);
    expect((await readError(res)).code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 without the permission", async () => {
    const student = await createUser();
    const res = await appWithProtectedRoute().request("/v1/test/exports", {
      headers: await authHeaders(student.id),
    });
    expect(res.status).toBe(403);
    expect((await readError(res)).code).toBe("FORBIDDEN");
  });

  it("lets a board member through", async () => {
    const president = await createUser();
    const year = await createSchoolYear();
    await createMembership({
      userId: president.id,
      schoolYearId: year.id,
      role: "board",
      boardPosition: "president",
    });
    const res = await appWithProtectedRoute().request("/v1/test/exports", {
      headers: await authHeaders(president.id),
    });
    expect(res.status).toBe(200);
  });
});
