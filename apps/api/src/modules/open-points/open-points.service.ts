import type {
  AdjustOpenPointsInput,
  LedgerEntryDto,
  MyOpenPointsDto,
  OpenPointsAccountDto,
  OpenPointsMovementDto,
  OpenPointsStatus,
} from "@bde/shared";
import { z } from "zod";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import type { DomainEvents } from "../../core/events";
import { decodeCursor, type Page, PgTimestampText, toPage } from "../../core/http";
import { inTransaction } from "../../core/tx";
import { currentSchoolYear, requireCurrentSchoolYear } from "../school-years";
import {
  decideMovements,
  findActiveMemberIds,
  findLedgerEntries,
  findTotals,
  findUserById,
  findUserMovements,
  insertMovement,
  type MovementRow,
  searchUsers,
} from "./open-points.repo";

function toMovement(row: MovementRow): OpenPointsMovementDto {
  return {
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    source: row.source,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    event:
      row.eventId && row.eventSlug && row.eventTitle
        ? { id: row.eventId, slug: row.eventSlug, title: row.eventTitle }
        : null,
  };
}

/**
 * `checkin.recorded` subscriber: a participant who is not a BDE member this year earns the
 * event's points, pending validation by the board. Runs in the check-in transaction.
 */
export async function onCheckinRecorded(payload: DomainEvents["checkin.recorded"]) {
  if (payload.kind !== "participant" || payload.event.openPointsValue <= 0) return;
  const year = await currentSchoolYear({ db: payload.db });
  // Without a current school year there is nowhere to record points: the check-in stands.
  if (!year) return;
  const members = await findActiveMemberIds(payload.db, [payload.userId], year.id);
  if (members.has(payload.userId)) return;
  await insertMovement(payload.db, {
    userId: payload.userId,
    schoolYearId: year.id,
    delta: payload.event.openPointsValue,
    reason: `Participation : ${payload.event.title}`,
    source: "auto",
    attendanceId: payload.attendanceId,
    createdBy: payload.actorUserId,
  });
}

export async function getMyOpenPoints(ctx: AuthedCtx): Promise<MyOpenPointsDto> {
  const year = await currentSchoolYear(ctx);
  if (!year) return { schoolYear: null, isMember: false, balance: 0, pending: 0, movements: [] };
  const [members, totals, movements] = await Promise.all([
    findActiveMemberIds(ctx.db, [ctx.user.id], year.id),
    findTotals(ctx.db, [ctx.user.id], year.id),
    findUserMovements(ctx.db, ctx.user.id, year.id),
  ]);
  const total = totals.get(ctx.user.id) ?? { balance: 0, pending: 0 };
  return {
    schoolYear: year,
    isMember: members.has(ctx.user.id),
    ...total,
    movements: movements.map(toMovement),
  };
}

const LedgerCursor = z.object({ c: PgTimestampText, id: z.uuid() });

export async function listLedger(
  ctx: AuthedCtx,
  query: {
    status: OpenPointsStatus;
    eventId?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  },
): Promise<Page<LedgerEntryDto>> {
  const year = await requireCurrentSchoolYear(ctx);
  const after = query.cursor ? decodeCursor(query.cursor, LedgerCursor) : null;
  const rows = await findLedgerEntries(ctx.db, {
    schoolYearId: year.id,
    status: query.status,
    eventId: query.eventId,
    after: after ? { createdAtKey: after.c, id: after.id } : null,
    limit: query.limit,
  });
  return toPage(
    rows,
    query.limit,
    (row) => ({ ...toMovement(row), user: row.user }),
    (row) => ({ c: row.createdAtKey, id: row.id }),
  );
}

export async function decideOpenPoints(
  ctx: AuthedCtx,
  ids: string[],
  status: "validated" | "rejected",
  now: Date = new Date(),
): Promise<{ updated: number; skipped: number }> {
  const unique = [...new Set(ids)];
  const updated = await inTransaction(ctx.db, async (tx) => {
    const changed = await decideMovements(tx, unique, {
      status,
      decidedBy: ctx.user.id,
      decidedAt: now,
    });
    if (changed.length > 0) {
      await writeAudit(tx, {
        actorUserId: ctx.user.id,
        action: status === "validated" ? "open_points.validated" : "open_points.rejected",
        entity: "open_points_ledger",
        payload: { ids: changed },
      });
    }
    return changed.length;
  });
  return { updated, skipped: unique.length - updated };
}

/** Manual adjustment by the board: validated at once, reason mandatory, audited. */
export async function adjustOpenPoints(
  ctx: AuthedCtx,
  input: AdjustOpenPointsInput,
  now: Date = new Date(),
): Promise<OpenPointsMovementDto> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new AppError(
      "MANUAL_ADJUSTMENT_REQUIRES_REASON",
      422,
      "Indique le motif de l'ajustement.",
    );
  }
  const year = await requireCurrentSchoolYear(ctx);
  const target = await findUserById(ctx.db, input.userId);
  if (!target) throw new AppError("NOT_FOUND", 404, "Cet étudiant n'existe pas.");
  if ((await findActiveMemberIds(ctx.db, [target.id], year.id)).has(target.id)) {
    throw new AppError(
      "MEMBERS_HAVE_NO_OPEN_POINTS",
      422,
      `${target.name} est membre du BDE cette année : les membres n'ont pas de points open.`,
    );
  }
  return inTransaction(ctx.db, async (tx) => {
    const id = await insertMovement(tx, {
      userId: target.id,
      schoolYearId: year.id,
      delta: input.delta,
      reason,
      source: "manual",
      status: "validated",
      decidedBy: ctx.user.id,
      decidedAt: now,
      createdBy: ctx.user.id,
    });
    if (!id) throw new Error("adjustOpenPoints: mouvement non inséré");
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "open_points.adjusted",
      entity: "open_points_ledger",
      entityId: id,
      payload: { userId: target.id, delta: input.delta, reason },
    });
    return {
      id,
      delta: input.delta,
      reason,
      source: "manual" as const,
      status: "validated" as const,
      createdAt: now.toISOString(),
      decidedAt: now.toISOString(),
      event: null,
    };
  });
}

export async function searchAccounts(
  ctx: AuthedCtx,
  query: string,
): Promise<OpenPointsAccountDto[]> {
  const year = await requireCurrentSchoolYear(ctx);
  const users = await searchUsers(ctx.db, query);
  const ids = users.map((u) => u.id);
  const [members, totals] = await Promise.all([
    findActiveMemberIds(ctx.db, ids, year.id),
    findTotals(ctx.db, ids, year.id),
  ]);
  return users.map((u) => ({
    user: u,
    isMember: members.has(u.id),
    ...(totals.get(u.id) ?? { balance: 0, pending: 0 }),
  }));
}
