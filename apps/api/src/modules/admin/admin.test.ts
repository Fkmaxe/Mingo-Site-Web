import { AdminUserDto, AuditEntryDto, PoleDto, SchoolYearDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog, user } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createPersona, createPole, createSchoolYear, createUser } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";
import { setAdminByEmail } from "./admin.service";

type User = Awaited<ReturnType<typeof createUser>>;
let admin: User;

beforeEach(async () => {
  admin = await createUser({ isAdmin: true, name: "Admin Site" });
});

const audits = async (action: string) =>
  getTestDb().select().from(auditLog).where(eq(auditLog.action, action));

describe("access", () => {
  it("is reserved to administrators, the board included otherwise", async () => {
    await createSchoolYear();
    const board = await createPersona("board");
    expect((await call("GET", "/v1/admin/users", null)).status).toBe(401);
    expect((await call("GET", "/v1/admin/users", board.id)).status).toBe(403);
    expect((await call("GET", "/v1/admin/school-years", board.id)).status).toBe(403);
    expect((await call("GET", "/v1/admin/audit", board.id)).status).toBe(403);
    expect((await call("GET", "/v1/admin/users", admin.id)).status).toBe(200);
  });

  it("gives an administrator every action of the site, without any membership", async () => {
    const pole = await createPole();
    await createSchoolYear();
    const res = await call("POST", "/v1/events", admin.id, {
      poleId: pole.id,
      title: "Soirée de l'admin",
      description: "",
      location: "ESGI",
      startsAt: "2026-12-10T18:00:00.000Z",
      endsAt: "2026-12-10T22:00:00.000Z",
      visibility: "students",
      openPointsValue: 0,
    });
    expect(res.status).toBe(201);
  });
});

describe("school years", () => {
  it("makes the first year current, refuses a duplicate, switches the current year", async () => {
    const first = await readJson(
      await call("POST", "/v1/admin/school-years", admin.id, {
        label: "2026-2027",
        startsOn: "2026-09-01",
        endsOn: "2027-08-31",
      }),
      z.array(SchoolYearDto),
    );
    expect(first).toMatchObject([{ label: "2026-2027", isCurrent: true }]);

    const duplicate = await call("POST", "/v1/admin/school-years", admin.id, {
      label: "2026-2027",
      startsOn: "2026-09-01",
      endsOn: "2027-08-31",
    });
    expect(duplicate.status).toBe(409);
    expect((await readError(duplicate)).code).toBe("ALREADY_EXISTS");

    const both = await readJson(
      await call("POST", "/v1/admin/school-years", admin.id, {
        label: "2027-2028",
        startsOn: "2027-09-01",
        endsOn: "2028-08-31",
      }),
      z.array(SchoolYearDto),
    );
    const next = both.find((y) => y.label === "2027-2028");
    expect(next?.isCurrent).toBe(false);
    const switched = await readJson(
      await call("POST", `/v1/admin/school-years/${next?.id}/current`, admin.id),
      z.array(SchoolYearDto),
    );
    expect(switched.filter((y) => y.isCurrent).map((y) => y.label)).toEqual(["2027-2028"]);
    expect(await audits("school_year.made_current")).toHaveLength(1);
  });

  it("validates the dates", async () => {
    const res = await call("POST", "/v1/admin/school-years", admin.id, {
      label: "2026-2027",
      startsOn: "2027-08-31",
      endsOn: "2026-09-01",
    });
    expect(res.status).toBe(400);
  });
});

describe("poles", () => {
  it("creates a pole with a slug, renames it, refuses a duplicate name", async () => {
    const created = await readJson(
      await call("POST", "/v1/admin/poles", admin.id, { name: "Événementiel" }),
      PoleDto,
    );
    expect(created).toMatchObject({ name: "Événementiel", slug: "evenementiel" });

    const renamed = await readJson(
      await call("PUT", `/v1/admin/poles/${created.id}`, admin.id, {
        name: "Événements",
        description: "Soirées et sorties",
      }),
      PoleDto,
    );
    expect(renamed).toMatchObject({ name: "Événements", slug: "evenementiel" });

    const duplicate = await call("POST", "/v1/admin/poles", admin.id, { name: "événements" });
    expect((await readError(duplicate)).code).toBe("ALREADY_EXISTS");
    expect(await audits("pole.created")).toHaveLength(1);
  });
});

describe("members and roles", () => {
  it("gives and changes roles for the current year, then removes one", async () => {
    await createSchoolYear();
    const sport = await createPole({ name: "Sport" });
    const camille = await createUser({ name: "Camille" });

    const member = await readJson(
      await call("POST", "/v1/admin/memberships", admin.id, {
        userId: camille.id,
        role: "member",
        poleId: sport.id,
      }),
      AdminUserDto,
    );
    expect(member.memberships).toMatchObject([{ role: "member", pole: { name: "Sport" } }]);

    // Same pole again: the role changes, no second membership.
    const lead = await readJson(
      await call("POST", "/v1/admin/memberships", admin.id, {
        userId: camille.id,
        role: "pole_lead",
        poleId: sport.id,
      }),
      AdminUserDto,
    );
    expect(lead.memberships.map((m) => m.role)).toEqual(["pole_lead"]);

    const board = await readJson(
      await call("POST", "/v1/admin/memberships", admin.id, {
        userId: camille.id,
        role: "board",
        boardPosition: "treasurer",
      }),
      AdminUserDto,
    );
    expect(board.memberships.map((m) => [m.role, m.boardPosition]).sort()).toEqual([
      ["board", "treasurer"],
      ["pole_lead", null],
    ]);

    // The new role applies at once.
    const me = await readJson(
      await call("GET", "/v1/me", camille.id),
      z.object({ permissions: z.array(z.string()) }),
    );
    expect(me.permissions).toContain("budget:manage");

    const leadMembership = board.memberships.find((m) => m.role === "pole_lead");
    const after = await readJson(
      await call("DELETE", `/v1/admin/memberships/${leadMembership?.id}`, admin.id),
      AdminUserDto,
    );
    expect(after.memberships.map((m) => m.role)).toEqual(["board"]);

    // A removed membership comes back on the same row (unique per person, pole and year).
    const back = await readJson(
      await call("POST", "/v1/admin/memberships", admin.id, {
        userId: camille.id,
        role: "member",
        poleId: sport.id,
      }),
      AdminUserDto,
    );
    expect(back.memberships.find((m) => m.pole?.id === sport.id)?.id).toBe(leadMembership?.id);
    expect(await audits("membership.set")).toHaveLength(4);
    expect(await audits("membership.removed")).toHaveLength(1);
  });

  it("validates the role and needs a current school year", async () => {
    const camille = await createUser();
    const noPole = await call("POST", "/v1/admin/memberships", admin.id, {
      userId: camille.id,
      role: "member",
    });
    expect(noPole.status).toBe(400);

    const noYear = await call("POST", "/v1/admin/memberships", admin.id, {
      userId: camille.id,
      role: "board",
      boardPosition: "president",
    });
    expect(noYear.status).toBe(422);
    expect((await readError(noYear)).code).toBe("NO_CURRENT_SCHOOL_YEAR");
  });

  it("lists the people with a role, and finds anyone by name or email", async () => {
    await createSchoolYear();
    const pole = await createPole();
    const member = await createPersona("member", { poleId: pole.id });
    const student = await createUser({ name: "Zoé Inconnue", email: "zoe.inconnue@myskolae.fr" });

    const holders = await readJson(
      await call("GET", "/v1/admin/users", admin.id),
      z.array(AdminUserDto),
    );
    expect(holders.map((u) => u.id).sort()).toEqual([admin.id, member.id].sort());

    const found = await readJson(
      await call("GET", "/v1/admin/users?q=inconnue", admin.id),
      z.array(AdminUserDto),
    );
    expect(found.map((u) => u.id)).toEqual([student.id]);
  });

  it("grants the administrator right, but not removing one's own", async () => {
    const camille = await createUser();
    const granted = await readJson(
      await call("PUT", `/v1/admin/users/${camille.id}/admin`, admin.id, { isAdmin: true }),
      AdminUserDto,
    );
    expect(granted.isAdmin).toBe(true);

    const self = await call("PUT", `/v1/admin/users/${admin.id}/admin`, admin.id, {
      isAdmin: false,
    });
    expect(self.status).toBe(403);
    expect(await audits("user.admin_granted")).toHaveLength(1);
  });
});

describe("server command make-admin", () => {
  it("grants the right by email (any case), audited without actor", async () => {
    const camille = await createUser({ email: "camille.d@myskolae.fr" });
    expect(await setAdminByEmail(getTestDb(), "Camille.D@myskolae.fr", true)).toMatchObject({
      email: "camille.d@myskolae.fr",
    });
    const [row] = await getTestDb().select().from(user).where(eq(user.id, camille.id));
    expect(row?.isAdmin).toBe(true);
    const [entry] = await audits("user.admin_granted");
    expect(entry).toMatchObject({ actorUserId: null, entityId: camille.id });
    expect(await setAdminByEmail(getTestDb(), "personne@myskolae.fr", true)).toBeNull();
  });
});

describe("audit log", () => {
  it("lists the latest entries first, with their author, page by page", async () => {
    for (const name of ["Un", "Deux", "Trois"]) {
      await call("POST", "/v1/admin/poles", admin.id, { name: `Pôle ${name}` });
    }
    const Page = z.object({ items: z.array(AuditEntryDto), nextCursor: z.string().nullable() });
    const first = await readJson(await call("GET", "/v1/admin/audit?limit=2", admin.id), Page);
    expect(first.items.map((e) => e.payload?.name)).toEqual(["Pôle Trois", "Pôle Deux"]);
    expect(first.items[0]?.actor).toEqual({ id: admin.id, name: "Admin Site" });
    const second = await readJson(
      await call("GET", `/v1/admin/audit?limit=2&cursor=${first.nextCursor}`, admin.id),
      Page,
    );
    expect(second.items.map((e) => e.payload?.name)).toEqual(["Pôle Un"]);
  });
});
