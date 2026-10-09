import { randomUUID } from "node:crypto";
import { type BoardPosition, type MembershipRole, splitName } from "@bde/shared";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { attendance, event, membership, pole, schoolYear, user } from "../db/schema";
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
  // First and last name follow `name` unless given, like a real sign-up.
  const name = overrides.name ?? `Test ${suffix}`;
  return first(
    await db
      .insert(user)
      .values({
        name,
        ...splitName(name),
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

type Persona = "student" | "member" | "pole_lead" | "board";

/**
 * A user with the given role in the current school year (created if needed).
 * `poleId` is required for member and pole_lead.
 */
export async function createPersona(
  persona: Persona,
  options: { poleId?: string; schoolYearId?: string } = {},
  db: DbOrTx = getTestDb(),
) {
  const user = await createUser({}, db);
  if (persona === "student") return user;
  const schoolYearId = options.schoolYearId ?? (await currentSchoolYearId(db));
  if (persona === "board") {
    await createMembership(
      { userId: user.id, schoolYearId, role: "board", boardPosition: "president" },
      db,
    );
  } else {
    if (!options.poleId) throw new Error(`createPersona(${persona}) demande un poleId`);
    await createMembership(
      { userId: user.id, schoolYearId, role: persona, poleId: options.poleId },
      db,
    );
  }
  return user;
}

async function currentSchoolYearId(db: DbOrTx): Promise<string> {
  const [current] = await db
    .select({ id: schoolYear.id })
    .from(schoolYear)
    .where(eq(schoolYear.isCurrent, true));
  return current?.id ?? (await createSchoolYear({}, db)).id;
}

export async function createEvent(
  overrides: Partial<typeof event.$inferInsert> & { poleId: string },
  db: DbOrTx = getTestDb(),
) {
  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return first(
    await db
      .insert(event)
      .values({
        title: `Événement ${suffix}`,
        slug: `evenement-${suffix}`,
        location: "ESGI Paris",
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3 * 3600 * 1000),
        visibility: "students",
        status: "published",
        ...overrides,
      })
      .returning(),
  );
}

export async function createAttendance(
  input: { eventId: string; userId: string; kind?: "participant" | "staff" | "meeting" },
  db: DbOrTx = getTestDb(),
) {
  return first(
    await db
      .insert(attendance)
      .values({ kind: "participant", ...input })
      .returning(),
  );
}
