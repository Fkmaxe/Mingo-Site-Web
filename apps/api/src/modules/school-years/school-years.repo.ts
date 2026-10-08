import { eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { schoolYear } from "../../db/schema";

export async function findCurrentSchoolYear(db: DbOrTx) {
  const [row] = await db
    .select({ id: schoolYear.id, label: schoolYear.label })
    .from(schoolYear)
    .where(eq(schoolYear.isCurrent, true));
  return row;
}

export async function findSchoolYearById(db: DbOrTx, schoolYearId: string) {
  const [row] = await db
    .select({
      id: schoolYear.id,
      label: schoolYear.label,
      startsOn: schoolYear.startsOn,
      endsOn: schoolYear.endsOn,
    })
    .from(schoolYear)
    .where(eq(schoolYear.id, schoolYearId));
  return row;
}
