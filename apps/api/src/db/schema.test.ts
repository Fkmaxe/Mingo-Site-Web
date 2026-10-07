import { describe, expect, it } from "vitest";
import { getTestDb } from "../test/db";
import { createMembership, createPole, createSchoolYear, createUser } from "../test/factories";
import { expectPgError, PG } from "../test/pg";

describe("database constraints", () => {
  it("rejects an email outside @myskolae.fr", async () => {
    await expectPgError(createUser({ email: "someone@gmail.com" }), PG.CHECK_VIOLATION);
  });

  it("accepts an @myskolae.fr email", async () => {
    const user = await createUser({ email: "jeanne.durand@myskolae.fr" });
    expect(user.isAdmin).toBe(false);
  });

  it("allows only one current school year", async () => {
    await createSchoolYear({ label: "2026-2027", isCurrent: true });
    await expectPgError(
      createSchoolYear({ label: "2027-2028", startsOn: "2027-09-01", endsOn: "2028-08-31" }),
      PG.UNIQUE_VIOLATION,
    );
    await createSchoolYear({
      label: "2025-2026",
      startsOn: "2025-09-01",
      endsOn: "2026-08-31",
      isCurrent: false,
    });
  });

  it("rejects a school year ending before it starts", async () => {
    await expectPgError(
      createSchoolYear({ startsOn: "2027-01-01", endsOn: "2026-01-01" }),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects a duplicate membership for the same pole and year", async () => {
    const [user, year, pole] = await Promise.all([createUser(), createSchoolYear(), createPole()]);
    const base = { userId: user.id, schoolYearId: year.id, poleId: pole.id };
    await createMembership({ ...base, role: "member" });
    await expectPgError(createMembership({ ...base, role: "pole_lead" }), PG.UNIQUE_VIOLATION);
  });

  it("rejects a duplicate board membership (null pole) for the same year", async () => {
    const [user, year] = await Promise.all([createUser(), createSchoolYear()]);
    const base = { userId: user.id, schoolYearId: year.id, role: "board" as const };
    await createMembership(base);
    await expectPgError(createMembership(base), PG.UNIQUE_VIOLATION);
  });

  it("requires board memberships to have no pole and pole memberships to have one", async () => {
    const [user, year, pole] = await Promise.all([createUser(), createSchoolYear(), createPole()]);
    await expectPgError(
      createMembership({ userId: user.id, schoolYearId: year.id, role: "board", poleId: pole.id }),
      PG.CHECK_VIOLATION,
    );
    await expectPgError(
      createMembership({ userId: user.id, schoolYearId: year.id, role: "member" }),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects a board position on a non-board membership", async () => {
    const [user, year, pole] = await Promise.all([createUser(), createSchoolYear(), createPole()]);
    await expectPgError(
      createMembership({
        userId: user.id,
        schoolYearId: year.id,
        role: "pole_lead",
        poleId: pole.id,
        boardPosition: "treasurer",
      }),
      PG.CHECK_VIOLATION,
    );
  });

  it("keeps the database usable after a failed insert", async () => {
    await expect(getTestDb().query.pole.findMany()).resolves.toEqual([]);
  });
});
