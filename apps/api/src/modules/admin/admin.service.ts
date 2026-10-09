import type {
  AdminUserDto,
  AuditEntryDto,
  PoleDto,
  SchoolYearDto,
  SetMembershipInput,
} from "@bde/shared";
import { z } from "zod";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { decodeCursor, type Page, PgTimestampText, toPage } from "../../core/http";
import { inTransaction } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { slugify, uniqueSlug } from "../events/slug";
import { getPole } from "../poles";
import { currentSchoolYear, requireCurrentSchoolYear } from "../school-years";
import {
  findActiveMemberships,
  findAuditEntries,
  findMembership,
  findMembershipRow,
  findSchoolYear,
  findSchoolYears,
  findUser,
  findUserByEmail,
  findUsers,
  hasCurrentSchoolYear,
  insertMembership,
  insertPole,
  insertSchoolYear,
  makeCurrentSchoolYear,
  poleNameTaken,
  poleSlugExists,
  removeMembership,
  reviveMembership,
  schoolYearLabelExists,
  setUserAdmin,
  updatePole,
} from "./admin.repo";

const userNotFound = () => new AppError("NOT_FOUND", 404, "Cette personne n'a pas de compte.");

// --- School years ---

export async function listSchoolYears(ctx: Pick<AuthedCtx, "db">): Promise<SchoolYearDto[]> {
  return (await findSchoolYears(ctx.db)).map((y) => ({
    ...y,
    startsOn: String(y.startsOn),
    endsOn: String(y.endsOn),
  }));
}

/** The first year ever created becomes the current one. */
export async function createSchoolYear(
  ctx: AuthedCtx,
  input: { label: string; startsOn: string; endsOn: string },
): Promise<SchoolYearDto[]> {
  await inTransaction(ctx.db, async (tx) => {
    if (await schoolYearLabelExists(tx, input.label)) {
      throw new AppError("ALREADY_EXISTS", 409, `L'année ${input.label} existe déjà.`);
    }
    const isCurrent = !(await hasCurrentSchoolYear(tx));
    const id = await insertSchoolYear(tx, { ...input, isCurrent });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "school_year.created",
      entity: "school_year",
      entityId: id,
      payload: { ...input, isCurrent },
    });
  });
  return listSchoolYears(ctx);
}

/** Switches the current year: roles, grades and open points follow it. */
export async function setCurrentSchoolYear(ctx: AuthedCtx, id: string): Promise<SchoolYearDto[]> {
  const year = await findSchoolYear(ctx.db, id);
  if (!year) throw new AppError("NOT_FOUND", 404, "Cette année scolaire n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    await makeCurrentSchoolYear(tx, id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "school_year.made_current",
      entity: "school_year",
      entityId: id,
      payload: { label: year.label },
    });
  });
  return listSchoolYears(ctx);
}

// --- Poles ---

export async function createPole(
  ctx: AuthedCtx,
  input: { name: string; description: string | null },
): Promise<PoleDto> {
  const id = await inTransaction(ctx.db, async (tx) => {
    if (await poleNameTaken(tx, input.name)) {
      throw new AppError("ALREADY_EXISTS", 409, `Le pôle « ${input.name} » existe déjà.`);
    }
    const slug = await uniqueSlug(slugify(input.name), (s) => poleSlugExists(tx, s));
    const poleId = await insertPole(tx, { ...input, slug });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "pole.created",
      entity: "pole",
      entityId: poleId,
      payload: { name: input.name },
    });
    return poleId;
  });
  return getPole(ctx, id);
}

/** Name and description; the slug (in URLs) stays. */
export async function editPole(
  ctx: AuthedCtx,
  id: string,
  input: { name: string; description: string | null },
): Promise<PoleDto> {
  const before = await getPole(ctx, id);
  await inTransaction(ctx.db, async (tx) => {
    if (await poleNameTaken(tx, input.name, id)) {
      throw new AppError("ALREADY_EXISTS", 409, `Le pôle « ${input.name} » existe déjà.`);
    }
    await updatePole(tx, id, input);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "pole.updated",
      entity: "pole",
      entityId: id,
      payload: { from: before.name, to: input.name },
    });
  });
  return getPole(ctx, id);
}

// --- Members and roles ---

async function withMemberships(
  db: DbOrTx,
  users: Awaited<ReturnType<typeof findUsers>>,
  schoolYearId: string | null,
): Promise<AdminUserDto[]> {
  const memberships = schoolYearId
    ? await findActiveMemberships(
        db,
        users.map((u) => u.id),
        schoolYearId,
      )
    : [];
  return users.map((u) => ({
    ...u,
    memberships: memberships
      .filter((m) => m.userId === u.id)
      .map(({ userId: _, ...m }) => ({ ...m, pole: m.pole?.id ? m.pole : null })),
  }));
}

export async function listUsers(
  ctx: AuthedCtx,
  query: { q?: string | undefined },
): Promise<AdminUserDto[]> {
  const year = await currentSchoolYear(ctx);
  const users = await findUsers(ctx.db, {
    q: query.q || undefined,
    schoolYearId: year?.id ?? null,
  });
  return withMemberships(ctx.db, users, year?.id ?? null);
}

async function getAdminUser(ctx: AuthedCtx, userId: string): Promise<AdminUserDto> {
  const found = await findUser(ctx.db, userId);
  if (!found) throw userNotFound();
  const year = await currentSchoolYear(ctx);
  const [dto] = await withMemberships(ctx.db, [found], year?.id ?? null);
  if (!dto) throw userNotFound();
  return dto;
}

/**
 * Gives a role for the current year: member or lead of a pole, or the board (with a position).
 * Same person and pole again: the role is changed (a removed membership comes back).
 */
export async function setMembership(
  ctx: AuthedCtx,
  input: z.output<typeof SetMembershipInput>,
): Promise<AdminUserDto> {
  const year = await requireCurrentSchoolYear(ctx);
  if (!(await findUser(ctx.db, input.userId))) throw userNotFound();
  if (input.poleId) await getPole(ctx, input.poleId);
  await inTransaction(ctx.db, async (tx) => {
    const key = { userId: input.userId, poleId: input.poleId, schoolYearId: year.id };
    const values = { role: input.role, boardPosition: input.boardPosition };
    const existing = await findMembershipRow(tx, key);
    let id: string;
    if (existing) {
      await reviveMembership(tx, existing.id, values);
      id = existing.id;
    } else {
      id = await insertMembership(tx, { ...key, ...values });
    }
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "membership.set",
      entity: "membership",
      entityId: id,
      payload: { ...key, ...values },
    });
  });
  return getAdminUser(ctx, input.userId);
}

export async function deleteMembership(
  ctx: AuthedCtx,
  membershipId: string,
): Promise<AdminUserDto> {
  const found = await findMembership(ctx.db, membershipId);
  if (!found || found.deletedAt) throw new AppError("NOT_FOUND", 404, "Ce rôle n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    await removeMembership(tx, membershipId, new Date());
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "membership.removed",
      entity: "membership",
      entityId: membershipId,
      payload: { userId: found.userId, poleId: found.poleId, role: found.role },
    });
  });
  return getAdminUser(ctx, found.userId);
}

/** Administrators have every permission. One cannot remove their own rights (no lock-out). */
export async function setAdmin(
  ctx: AuthedCtx,
  userId: string,
  isAdmin: boolean,
): Promise<AdminUserDto> {
  if (userId === ctx.user.id && !isAdmin) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "Tu ne peux pas retirer tes propres droits d'administrateur : demande à un autre admin.",
    );
  }
  const target = await findUser(ctx.db, userId);
  if (!target) throw userNotFound();
  await inTransaction(ctx.db, async (tx) => {
    await setUserAdmin(tx, userId, isAdmin);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: isAdmin ? "user.admin_granted" : "user.admin_revoked",
      entity: "user",
      entityId: userId,
      payload: { email: target.email },
    });
  });
  return getAdminUser(ctx, userId);
}

/**
 * Server command (make-admin): grants or revokes the administrator right by email. Run from a
 * shell on the server, so there is no actor; it is audited as such.
 */
export async function setAdminByEmail(
  db: DbOrTx,
  email: string,
  isAdmin: boolean,
): Promise<{ name: string; email: string } | null> {
  const target = await findUserByEmail(db, email);
  if (!target) return null;
  await inTransaction(db, async (tx) => {
    await setUserAdmin(tx, target.id, isAdmin);
    await writeAudit(tx, {
      actorUserId: null,
      action: isAdmin ? "user.admin_granted" : "user.admin_revoked",
      entity: "user",
      entityId: target.id,
      payload: { email: target.email, via: "server command" },
    });
  });
  return { name: target.name, email: target.email };
}

// --- Audit log ---

const AuditCursor = z.object({ c: PgTimestampText, id: z.uuid() });

export async function listAuditEntries(
  ctx: AuthedCtx,
  query: { cursor?: string | undefined; limit: number },
): Promise<Page<AuditEntryDto>> {
  const after = query.cursor ? decodeCursor(query.cursor, AuditCursor) : null;
  const rows = await findAuditEntries(ctx.db, {
    after: after ? { createdAtKey: after.c, id: after.id } : null,
    limit: query.limit,
  });
  return toPage(
    rows,
    query.limit,
    ({ createdAtKey: _, actor, ...row }) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      actor: actor?.id ? actor : null,
    }),
    (row) => ({ c: row.createdAtKey, id: row.id }),
  );
}
