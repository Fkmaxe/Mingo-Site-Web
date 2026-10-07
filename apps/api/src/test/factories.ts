import { randomUUID } from "node:crypto";
import type { BoardPosition, MembershipRole } from "@bde/shared";
import type { DbOrTx } from "../db/client";
import { membership, pole, schoolYear, user } from "../db/schema";
import { getTestDb } from "./db";

function first<T>(rows: T[]): T {
  const [row] = rows;
  if (!row) throw new Error("Insertion de test sans résultat");
  return row;
}

export async function createUser(
  overrides: Partial<typeof user.$inferInsert> = {},
  db: DbOrTx = getTestDb(),
) {
  const suffix = randomUUID().slice(0, 8);
  return first(
    await db
      .insert(user)
      .values({
        name: `Test ${suffix}`,
        email: `test.${suffix}@myskolae.fr`,
        emailVerified: true,
        ...overrides,
      })
      .returning(),
  );
}

export async function createSchoolYear(
  overrides: Partial<typeof schoolYear.$inferInsert> = {},
  db: DbOrTx = getTestDb(),
) {
  return first(
    await db
      .insert(schoolYear)
      .values({
        label: "2026-2027",
        startsOn: "2026-09-01",
        endsOn: "2027-08-31",
        isCurrent: true,
        ...overrides,
      })
      .returning(),
  );
}

export async function createPole(
  overrides: Partial<typeof pole.$inferInsert> = {},
  db: DbOrTx = getTestDb(),
) {
  const slug = overrides.slug ?? `pole-${randomUUID().slice(0, 8)}`;
  return first(
    await db
      .insert(pole)
      .values({ name: slug, ...overrides, slug })
      .returning(),
  );
}

export async function createMembership(
  input: {
    userId: string;
    schoolYearId: string;
    role: MembershipRole;
    poleId?: string | null;
    boardPosition?: BoardPosition | null;
    isActive?: boolean;
  },
  db: DbOrTx = getTestDb(),
) {
  return first(
    await db
      .insert(membership)
      .values({
        poleId: null,
        boardPosition: null,
        ...input,
      })
      .returning(),
  );
}
