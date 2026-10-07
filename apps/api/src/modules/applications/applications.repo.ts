import type { ApplicationStatus } from "@bde/shared";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { application, membership, pole, user } from "../../db/schema";

const selection = {
  application,
  wishedPole: { id: pole.id, name: pole.name },
  user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
};

export type ApplicationRow = NonNullable<Awaited<ReturnType<typeof findApplication>>>;

function baseQuery(db: DbOrTx) {
  return db
    .select(selection)
    .from(application)
    .innerJoin(pole, eq(pole.id, application.wishedPoleId))
    .innerJoin(user, eq(user.id, application.userId));
}

export async function findApplication(db: DbOrTx, applicationId: string) {
  const [row] = await baseQuery(db).where(eq(application.id, applicationId));
  return row;
}

export async function findUserApplication(db: DbOrTx, userId: string, schoolYearId: string) {
  const [row] = await baseQuery(db).where(
    and(eq(application.userId, userId), eq(application.schoolYearId, schoolYearId)),
  );
  return row;
}

export function findApplications(
  db: DbOrTx,
  params: {
    schoolYearId: string;
    status: ApplicationStatus | undefined;
    poleIds: "all" | string[];
  },
) {
  if (params.poleIds !== "all" && params.poleIds.length === 0) return Promise.resolve([]);
  return baseQuery(db)
    .where(
      and(
        eq(application.schoolYearId, params.schoolYearId),
        params.status ? eq(application.status, params.status) : undefined,
        params.poleIds === "all" ? undefined : inArray(application.wishedPoleId, params.poleIds),
      ),
    )
    .orderBy(desc(application.createdAt))
    .limit(200);
}

export async function insertApplication(db: DbOrTx, values: typeof application.$inferInsert) {
  const [row] = await db.insert(application).values(values).returning({ id: application.id });
  if (!row) throw new Error("insertApplication: aucune ligne");
  return row.id;
}

export async function deleteApplication(db: DbOrTx, applicationId: string) {
  await db.delete(application).where(eq(application.id, applicationId));
}

export async function setStatus(
  db: DbOrTx,
  applicationId: string,
  status: ApplicationStatus,
  decidedBy: string,
) {
  await db.update(application).set({ status, decidedBy }).where(eq(application.id, applicationId));
}

export async function findActiveMembership(
  db: DbOrTx,
  userId: string,
  schoolYearId: string,
  poleId: string,
) {
  const [row] = await db
    .select({ id: membership.id })
    .from(membership)
    .where(
      and(
        eq(membership.userId, userId),
        eq(membership.schoolYearId, schoolYearId),
        eq(membership.poleId, poleId),
        isNull(membership.deletedAt),
      ),
    );
  return row;
}

export async function insertMembership(db: DbOrTx, values: typeof membership.$inferInsert) {
  const [row] = await db.insert(membership).values(values).returning({ id: membership.id });
  if (!row) throw new Error("insertMembership: aucune ligne");
  return row.id;
}
