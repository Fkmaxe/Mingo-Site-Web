import type { ApplicationDto, ApplicationStatus, CreateApplicationInput } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { assertPoleAccess } from "../../core/permissions";
import { inTransactionWithEffects } from "../../core/tx";
import { getPole } from "../poles";
import { requireCurrentSchoolYear } from "../school-years";
import { acceptedEmail, rejectedEmail } from "./applications.emails";
import {
  type ApplicationRow,
  deleteApplication,
  findActiveMembership,
  findApplication,
  findApplications,
  findUserApplication,
  insertApplication,
  insertMembership,
  setStatus,
} from "./applications.repo";

function toDto(row: ApplicationRow): ApplicationDto {
  return {
    id: row.application.id,
    status: row.application.status,
    motivation: row.application.motivation,
    wishedPole: row.wishedPole,
    user: row.user,
    createdAt: row.application.createdAt.toISOString(),
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "Cette candidature n'existe pas.");

export async function apply(ctx: AuthedCtx, input: CreateApplicationInput) {
  const year = await requireCurrentSchoolYear(ctx);
  if (ctx.roles.includes("member")) {
    throw new AppError("ALREADY_MEMBER", 409, "Tu fais déjà partie du BDE cette année.");
  }
  if (await findUserApplication(ctx.db, ctx.user.id, year.id)) {
    throw new AppError("ALREADY_APPLIED", 409, "Tu as déjà candidaté cette année.");
  }
  await getPole(ctx, input.wishedPoleId);
  const id = await insertApplication(ctx.db, {
    userId: ctx.user.id,
    schoolYearId: year.id,
    wishedPoleId: input.wishedPoleId,
    motivation: input.motivation,
  });
  const row = await findApplication(ctx.db, id);
  if (!row) throw notFound();
  return toDto(row);
}

export async function getMyApplication(ctx: AuthedCtx): Promise<ApplicationDto | null> {
  const year = await requireCurrentSchoolYear(ctx);
  const row = await findUserApplication(ctx.db, ctx.user.id, year.id);
  return row ? toDto(row) : null;
}

export async function withdraw(ctx: AuthedCtx) {
  const year = await requireCurrentSchoolYear(ctx);
  const row = await findUserApplication(ctx.db, ctx.user.id, year.id);
  if (!row) throw notFound();
  if (row.application.status !== "new") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Ta candidature est déjà en cours d'examen : contacte le bureau.",
    );
  }
  await deleteApplication(ctx.db, row.application.id);
}

/** Board: every application; pole leads: those wishing for their pole. */
export async function listApplications(ctx: AuthedCtx, status: ApplicationStatus | undefined) {
  const year = await requireCurrentSchoolYear(ctx);
  const poleIds = ctx.permissions.has("poles:all")
    ? ("all" as const)
    : ctx.memberships.flatMap((m) => (m.role === "pole_lead" && m.poleId ? [m.poleId] : []));
  return (await findApplications(ctx.db, { schoolYearId: year.id, status, poleIds })).map(toDto);
}

async function reviewable(ctx: AuthedCtx, applicationId: string) {
  const row = await findApplication(ctx.db, applicationId);
  if (!row) throw notFound();
  assertPoleAccess(ctx, row.application.wishedPoleId);
  if (row.application.status === "accepted" || row.application.status === "rejected") {
    throw new AppError("INVALID_STATUS_TRANSITION", 409, "Cette candidature est déjà tranchée.");
  }
  return row;
}

export async function decide(
  ctx: AuthedCtx,
  applicationId: string,
  status: "interview" | "rejected",
) {
  const row = await reviewable(ctx, applicationId);
  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await setStatus(tx, row.application.id, status, ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: `application.${status}`,
      entity: "application",
      entityId: row.application.id,
      payload: { userId: row.user.id },
    });
    if (status === "rejected") {
      const url = `${ctx.services.webOrigin}/events`;
      defer(() => ctx.services.mailer.send(rejectedEmail(row.user, url)));
    }
  });
  return toDto((await findApplication(ctx.db, row.application.id)) ?? row);
}

/** Accepting creates the membership (pole may differ from the wish): a role change, audited. */
export async function accept(ctx: AuthedCtx, applicationId: string, poleId: string | undefined) {
  const row = await reviewable(ctx, applicationId);
  const targetPoleId = poleId ?? row.application.wishedPoleId;
  assertPoleAccess(ctx, targetPoleId);
  const target = await getPole(ctx, targetPoleId);
  if (await findActiveMembership(ctx.db, row.user.id, row.application.schoolYearId, target.id)) {
    throw new AppError("ALREADY_MEMBER", 409, `${row.user.name} est déjà membre de ce pôle.`);
  }
  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    const membershipId = await insertMembership(tx, {
      userId: row.user.id,
      poleId: target.id,
      schoolYearId: row.application.schoolYearId,
      role: "member",
    });
    await setStatus(tx, row.application.id, "accepted", ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "membership.created",
      entity: "membership",
      entityId: membershipId,
      payload: { userId: row.user.id, poleId: target.id, applicationId: row.application.id },
    });
    const url = `${ctx.services.webOrigin}/home`;
    defer(() => ctx.services.mailer.send(acceptedEmail(row.user, target.name, url)));
  });
  return toDto((await findApplication(ctx.db, row.application.id)) ?? row);
}
