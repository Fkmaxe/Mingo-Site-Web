import { count } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getTestDb } from "../test/db";
import { membership, pole, schoolYear, user } from "./schema";
import { SEED_POLES, SEED_USERS, seed } from "./seed";

async function counts() {
  const db = getTestDb();
  const [[years], [poles], [users], [memberships]] = await Promise.all([
    db.select({ n: count() }).from(schoolYear),
    db.select({ n: count() }).from(pole),
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(membership),
  ]);
  return { years: years?.n, poles: poles?.n, users: users?.n, memberships: memberships?.n };
}

describe("seed", () => {
  it("creates demo data and can be run twice", async () => {
    await seed(getTestDb());
    const expected = {
      years: 1,
      poles: SEED_POLES.length,
      users: SEED_USERS.length,
      memberships: SEED_USERS.filter((u) => u.membership).length,
    };
    expect(await counts()).toEqual(expected);

    await seed(getTestDb());
    expect(await counts()).toEqual(expected);
  });
});
