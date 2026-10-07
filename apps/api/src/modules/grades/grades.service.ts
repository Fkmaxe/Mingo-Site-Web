import {
  type CreateGradePeriodData,
  computeFinalScore,
  type GradePeriodDto,
  type MemberGradeDto,
  type MyGradesDto,
  type UpdateGradePeriodData,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { assertPoleAccess } from "../../core/permissions";
import { inTransaction } from "../../core/tx";
import { requireCurrentSchoolYear } from "../school-years";
import {
  countGradesWithStatus,
  deletePeriod,
  findGradedMemberships,
  findGrades,
  findGradesByIds,
  findMeetingPresences,
  findMembership,
  findPeriod,
  findPeriods,
  findPresences,
  findPublishedGradesOfUser,
  findSchoolYear,
  type GradePeriodRow,
  type GradeRow,
  insertPeriods,
  moveStatus,
  updateGrade,
  updatePeriod as updatePeriodRow,
  upsertGrade,
} from "./grades.repo";

function toPeriodDto(row: GradePeriodRow): GradePeriodDto {
  return {
    id: row.id,
    label: row.label,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    scaleMax: row.scaleMax,
    pointsPerPresence: row.pointsPerPresence,
  };
}

const periodNotFound = () => new AppError("NOT_FOUND", 404, "Cette période n'existe pas.");

async function requirePeriod(ctx: Pick<Ctx, "db">, periodId: string) {
  const period = await findPeriod(ctx.db, periodId);
  if (!period) throw periodNotFound();
  return period;
}

// ---------- Periods (board) ----------

export async function listPeriods(ctx: Ctx): Promise<GradePeriodDto[]> {
  const year = await requireCurrentSchoolYear(ctx);
  return (await findPeriods(ctx.db, year.id)).map(toPeriodDto);
}

export async function createPeriod(ctx: AuthedCtx, input: CreateGradePeriodData) {
  const year = await requireCurrentSchoolYear(ctx);
  const [row] = await insertPeriods(ctx.db, [{ schoolYearId: year.id, ...input }]);
  if (!row) throw new Error("createPeriod: aucune ligne");
  return toPeriodDto(row);
}

/** The default: three quarters covering the current school year. */
export async function generateQuarters(ctx: AuthedCtx): Promise<GradePeriodDto[]> {
  const current = await requireCurrentSchoolYear(ctx);
  if ((await findPeriods(ctx.db, current.id)).length > 0) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Des périodes existent déjà pour cette année.",
    );
  }
  const year = await findSchoolYear(ctx.db, current.id);
  if (!year) throw new Error("Année scolaire introuvable");
  const startYear = Number(year.startsOn.slice(0, 4));
  const endYear = startYear + 1;
  const rows = await insertPeriods(ctx.db, [
    {
      schoolYearId: year.id,
      label: "Trimestre 1",
      startsOn: year.startsOn,
      endsOn: `${startYear}-12-31`,
    },
    {
      schoolYearId: year.id,
      label: "Trimestre 2",
      startsOn: `${endYear}-01-01`,
      endsOn: `${endYear}-03-31`,
    },
    {
      schoolYearId: year.id,
      label: "Trimestre 3",
      startsOn: `${endYear}-04-01`,
      endsOn: year.endsOn,
    },
  ]);
  return rows.map(toPeriodDto);
}

export async function updatePeriod(ctx: AuthedCtx, periodId: string, input: UpdateGradePeriodData) {
  const period = await requirePeriod(ctx, periodId);
  const startsOn = input.startsOn ?? period.startsOn;
  const endsOn = input.endsOn ?? period.endsOn;
  if (endsOn < startsOn) {
    throw new AppError("VALIDATION_ERROR", 400, "La fin doit être après le début", {
      issues: [{ path: ["endsOn"], message: "La fin doit être après le début" }],
    });
  }
  await updatePeriodRow(ctx.db, period.id, input);
  return toPeriodDto(await requirePeriod(ctx, period.id));
}

export async function removePeriod(ctx: AuthedCtx, periodId: string) {
  const period = await requirePeriod(ctx, periodId);
  if ((await countGradesWithStatus(ctx.db, period.id, ["validated", "published"])) > 0) {
    throw new AppError(
      "GRADE_LOCKED",
      409,
      "Cette période a des notes validées ou publiées : elle ne peut plus être supprimée.",
    );
  }
  await deletePeriod(ctx.db, period.id);
}

// ---------- Grades ----------

/** Poles whose grades the user handles: every pole (board) or the poles they lead. */
function gradablePoles(ctx: Ctx, poleId: string | undefined): "all" | string[] {
  if (poleId) {
    assertPoleAccess(ctx, poleId);
    return [poleId];
  }
  if (ctx.permissions.has("poles:all")) return "all";
  return ctx.memberships.flatMap((m) => (m.role === "pole_lead" && m.poleId ? [m.poleId] : []));
}

type Presence = {
  userId: string;
  id: string;
  kind: "event" | "meeting";
  title: string;
  startsAt: Date;
  points: number;
};

/** Presences of the period: events (participant / staff) and meetings. */
async function findAllPresences(
  db: Parameters<typeof findPresences>[0],
  period: GradePeriodRow,
  userIds: string[],
): Promise<Presence[]> {
  const [events, meetings] = await Promise.all([
    findPresences(db, period, userIds),
    findMeetingPresences(db, period, userIds),
  ]);
  return [
    ...events.map((e) => ({ ...e, id: e.eventId, kind: "event" as const })),
    ...meetings.map((m) => ({
      userId: m.userId,
      id: m.meetingId,
      kind: "meeting" as const,
      title: m.title,
      startsAt: m.startsAt,
      points: period.pointsPerPresence,
    })),
  ];
}

function presenceTotals(presences: Presence[]) {
  const byUser = new Map<string, { points: number; count: number }>();
  for (const p of presences) {
    const total = byUser.get(p.userId) ?? { points: 0, count: 0 };
    total.points = Math.round((total.points + p.points) * 100) / 100;
    total.count++;
    byUser.set(p.userId, total);
  }
  return byUser;
}

function frozen(grade: GradeRow | undefined) {
  return grade?.status === "validated" || grade?.status === "published";
}

export async function listGrades(
  ctx: AuthedCtx,
  periodId: string,
  poleId: string | undefined,
): Promise<MemberGradeDto[]> {
  const period = await requirePeriod(ctx, periodId);
  const memberships = await findGradedMemberships(
    ctx.db,
    period.schoolYearId,
    gradablePoles(ctx, poleId),
  );
  const [presences, grades] = await Promise.all([
    findAllPresences(
      ctx.db,
      period,
      memberships.map((m) => m.user.id),
    ),
    findGrades(
      ctx.db,
      period.id,
      memberships.map((m) => m.membershipId),
    ),
  ]);
  const totals = presenceTotals(presences);
  const gradeOf = new Map(grades.map((g) => [g.membershipId, g]));

  return memberships.map((m) => {
    const grade = gradeOf.get(m.membershipId);
    const live = totals.get(m.user.id) ?? { points: 0, count: 0 };
    const presencePoints = frozen(grade) ? (grade?.presencePoints ?? 0) : live.points;
    const involvementPoints = grade?.involvementPoints ?? 0;
    return {
      id: grade?.id ?? null,
      membershipId: m.membershipId,
      user: m.user,
      pole: m.pole,
      status: grade?.status ?? "draft",
      presencePoints,
      presenceCount: live.count,
      involvementPoints,
      finalScore: frozen(grade)
        ? (grade?.finalScore ?? 0)
        : computeFinalScore(presencePoints, involvementPoints, period.scaleMax),
      comment: grade?.comment ?? "",
    };
  });
}

/**
 * Pole lead (or board) sets the pole points. Validated or published grades can only be
 * changed by the board, with an audit entry (rule 7 of docs/data-model.md).
 */
export async function saveGrade(
  ctx: AuthedCtx,
  periodId: string,
  input: { membershipId: string; involvementPoints: number; comment: string },
): Promise<MemberGradeDto> {
  const period = await requirePeriod(ctx, periodId);
  const target = await findMembership(ctx.db, input.membershipId);
  if (!target?.poleId || target.role === "board" || target.schoolYearId !== period.schoolYearId) {
    throw new AppError("NOT_FOUND", 404, "Ce membre n'est pas noté sur cette période.");
  }
  assertPoleAccess(ctx, target.poleId);
  if (input.involvementPoints > period.scaleMax) {
    throw new AppError("VALIDATION_ERROR", 400, `Au plus ${period.scaleMax} points de pôle.`, {
      issues: [{ path: ["involvementPoints"], message: `Au plus ${period.scaleMax} points` }],
    });
  }

  const [existing] = await findGrades(ctx.db, period.id, [target.id]);
  if (frozen(existing) && existing) {
    if (!ctx.permissions.has("grades:validate")) {
      throw new AppError(
        "GRADE_LOCKED",
        409,
        "Cette note est validée : seul le bureau peut encore la modifier.",
      );
    }
    const finalScore = computeFinalScore(
      existing.presencePoints ?? 0,
      input.involvementPoints,
      period.scaleMax,
    );
    await inTransaction(ctx.db, async (tx) => {
      await updateGrade(tx, existing.id, {
        involvementPoints: input.involvementPoints,
        comment: input.comment,
        finalScore,
      });
      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        action: "grade.updated_after_validation",
        entity: "member_grade",
        entityId: existing.id,
        payload: {
          status: existing.status,
          before: {
            involvementPoints: existing.involvementPoints,
            finalScore: existing.finalScore,
          },
          after: { involvementPoints: input.involvementPoints, finalScore },
        },
      });
    });
  } else {
    await upsertGrade(ctx.db, {
      membershipId: target.id,
      gradePeriodId: period.id,
      involvementPoints: input.involvementPoints,
      comment: input.comment,
      proposedBy: ctx.user.id,
    });
  }
  const [dto] = (await listGrades(ctx, period.id, target.poleId)).filter(
    (g) => g.membershipId === target.id,
  );
  if (!dto) throw new Error("saveGrade: note introuvable après enregistrement");
  return dto;
}

/** The lead hands the pole's drafts over to the board. */
export async function submitGrades(ctx: AuthedCtx, periodId: string, poleId: string) {
  const period = await requirePeriod(ctx, periodId);
  assertPoleAccess(ctx, poleId);
  const memberships = await findGradedMemberships(ctx.db, period.schoolYearId, [poleId]);
  const updated = await moveStatus(
    ctx.db,
    period.id,
    memberships.map((m) => m.membershipId),
    "draft",
    "submitted",
  );
  return { updated, skipped: 0 };
}

/** Board validation: presence points and final score are frozen. */
export async function validateGrades(ctx: AuthedCtx, ids: string[]) {
  const grades = (await findGradesByIds(ctx.db, [...new Set(ids)])).filter(
    (g) => g.status === "submitted",
  );
  let updated = 0;
  await inTransaction(ctx.db, async (tx) => {
    for (const grade of grades) {
      const period = await requirePeriod({ db: tx }, grade.gradePeriodId);
      const membership = await findMembership(tx, grade.membershipId);
      const presence = membership
        ? (presenceTotals(await findAllPresences(tx, period, [membership.userId])).get(
            membership.userId,
          )?.points ?? 0)
        : 0;
      await updateGrade(tx, grade.id, {
        status: "validated",
        presencePoints: presence,
        finalScore: computeFinalScore(presence, grade.involvementPoints, period.scaleMax),
        validatedBy: ctx.user.id,
      });
      updated++;
    }
    if (updated > 0) {
      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        action: "grade.validated",
        entity: "member_grade",
        payload: { ids: grades.map((g) => g.id) },
      });
    }
  });
  return { updated, skipped: new Set(ids).size - updated };
}

export async function publishGrades(ctx: AuthedCtx, ids: string[], now: Date = new Date()) {
  const grades = (await findGradesByIds(ctx.db, [...new Set(ids)])).filter(
    (g) => g.status === "validated",
  );
  await inTransaction(ctx.db, async (tx) => {
    for (const grade of grades) {
      await updateGrade(tx, grade.id, { status: "published", publishedAt: now });
    }
    if (grades.length > 0) {
      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        action: "grade.published",
        entity: "member_grade",
        payload: { ids: grades.map((g) => g.id) },
      });
    }
  });
  return { updated: grades.length, skipped: new Set(ids).size - grades.length };
}

/** A member sees their presences at any time, and their grade once published. */
export async function getMyGrades(ctx: AuthedCtx): Promise<MyGradesDto> {
  const year = await requireCurrentSchoolYear(ctx);
  const periods = await findPeriods(ctx.db, year.id);
  const published = await findPublishedGradesOfUser(
    ctx.db,
    ctx.user.id,
    periods.map((p) => p.id),
  );
  const result: MyGradesDto["periods"] = [];
  for (const period of periods) {
    const presences = await findAllPresences(ctx.db, period, [ctx.user.id]);
    const grade = published.find((g) => g.periodId === period.id);
    result.push({
      period: toPeriodDto(period),
      presences: presences
        .map((p) => ({
          id: p.id,
          kind: p.kind,
          title: p.title,
          startsAt: p.startsAt.toISOString(),
          points: p.points,
        }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      presencePoints: presenceTotals(presences).get(ctx.user.id)?.points ?? 0,
      grade: grade
        ? {
            involvementPoints: grade.involvementPoints,
            finalScore: grade.finalScore ?? 0,
            comment: grade.comment,
          }
        : null,
    });
  }
  return { periods: result };
}
