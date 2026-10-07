import type { Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { findCurrentSchoolYear } from "./school-years.repo";

export type SchoolYearRef = { id: string; label: string };

export function currentSchoolYear(ctx: Pick<Ctx, "db">): Promise<SchoolYearRef | undefined> {
  return findCurrentSchoolYear(ctx.db);
}

export async function requireCurrentSchoolYear(ctx: Pick<Ctx, "db">): Promise<SchoolYearRef> {
  const year = await findCurrentSchoolYear(ctx.db);
  if (!year) {
    throw new AppError(
      "NO_CURRENT_SCHOOL_YEAR",
      422,
      "Aucune année scolaire en cours : le bureau doit en définir une.",
    );
  }
  return year;
}
