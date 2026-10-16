import type { ApplicationStatus } from "@bde/shared";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import {
  application,
  applicationDocument,
  applicationForm,
  applicationFormPole,
  applicationWish,
  membership,
  pole,
  user,
} from "../../db/schema";

const selection = {
  application,
  user: { id: user.id, name: user.name, email: user.email, promo: user.promo },
};

export type ApplicationRow = NonNullable<Awaited<ReturnType<typeof findApplication>>>;

function baseQuery(db: DbOrTx) {
  return db.select(selection).from(application).innerJoin(user, eq(user.id, application.userId));
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

/** Applications of the year; with poles, those wishing for one of them (at any rank). */
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
        params.poleIds === "all"
          ? undefined
          : inArray(
              application.id,
              db
                .select({ id: applicationWish.applicationId })
                .from(applicationWish)
                .where(inArray(applicationWish.poleId, params.poleIds)),
            ),
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

// --- Wishes ---

export async function insertWishes(db: DbOrTx, applicationId: string, poleIds: string[]) {
  await db
    .insert(applicationWish)
    .values(poleIds.map((poleId, i) => ({ applicationId, poleId, rank: i + 1 })));
}

/** Ranked wishes of the applications, by application id. */
export async function findWishes(db: DbOrTx, applicationIds: string[]) {
  const byApplication = new Map<string, { id: string; name: string }[]>();
  if (applicationIds.length === 0) return byApplication;
  const rows = await db
    .select({ applicationId: applicationWish.applicationId, id: pole.id, name: pole.name })
    .from(applicationWish)
    .innerJoin(pole, eq(pole.id, applicationWish.poleId))
    .where(inArray(applicationWish.applicationId, applicationIds))
    .orderBy(asc(applicationWish.rank));
  for (const { applicationId, ...wish } of rows) {
    byApplication.set(applicationId, [...(byApplication.get(applicationId) ?? []), wish]);
  }
  return byApplication;
}

// --- Documents ---

export async function findDocuments(db: DbOrTx, applicationIds: string[]) {
  const byApplication = new Map<string, (typeof applicationDocument.$inferSelect)[]>();
  if (applicationIds.length === 0) return byApplication;
  const rows = await db
    .select()
    .from(applicationDocument)
    .where(inArray(applicationDocument.applicationId, applicationIds))
    .orderBy(asc(applicationDocument.createdAt));
  for (const row of rows) {
    byApplication.set(row.applicationId, [...(byApplication.get(row.applicationId) ?? []), row]);
  }
  return byApplication;
}

export async function findDocument(db: DbOrTx, applicationId: string, requirementKey: string) {
  const [row] = await db
    .select()
    .from(applicationDocument)
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        eq(applicationDocument.requirementKey, requirementKey),
      ),
    );
  return row;
}

export async function findDocumentByFileName(db: DbOrTx, fileName: string) {
  const [row] = await db
    .select()
    .from(applicationDocument)
    .where(eq(applicationDocument.fileName, fileName));
  return row;
}

/** Hands in (or replaces) the document of a requirement. */
export async function upsertDocument(
  db: DbOrTx,
  values: Omit<typeof applicationDocument.$inferInsert, "id" | "createdAt">,
) {
  await db
    .delete(applicationDocument)
    .where(
      and(
        eq(applicationDocument.applicationId, values.applicationId),
        eq(applicationDocument.requirementKey, values.requirementKey),
      ),
    );
  await db.insert(applicationDocument).values(values);
}

export async function deleteDocument(db: DbOrTx, documentId: string) {
  await db.delete(applicationDocument).where(eq(applicationDocument.id, documentId));
}

// --- Form ---

export async function findForm(db: DbOrTx, schoolYearId: string) {
  const [row] = await db
    .select()
    .from(applicationForm)
    .where(eq(applicationForm.schoolYearId, schoolYearId));
  return row;
}

export function findFormPoles(db: DbOrTx, formId: string) {
  return db
    .select({ id: pole.id, name: pole.name })
    .from(applicationFormPole)
    .innerJoin(pole, eq(pole.id, applicationFormPole.poleId))
    .where(eq(applicationFormPole.formId, formId))
    .orderBy(asc(pole.name));
}

/** Creates the year's form or replaces its settings, and its recruiting poles. */
export async function saveForm(
  db: DbOrTx,
  schoolYearId: string,
  values: Patch<typeof applicationForm.$inferInsert>,
  recruitingPoleIds: string[],
) {
  const settings = compact(values) ?? {};
  const [row] = await db
    .insert(applicationForm)
    .values({ schoolYearId, ...settings })
    .onConflictDoUpdate({ target: applicationForm.schoolYearId, set: settings })
    .returning({ id: applicationForm.id });
  if (!row) throw new Error("saveForm: aucune ligne");
  await db.delete(applicationFormPole).where(eq(applicationFormPole.formId, row.id));
  if (recruitingPoleIds.length > 0) {
    await db
      .insert(applicationFormPole)
      .values(recruitingPoleIds.map((poleId) => ({ formId: row.id, poleId })));
  }
}

// --- Memberships ---

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
