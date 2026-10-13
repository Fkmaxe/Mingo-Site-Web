import type { ClassesDto, ClassLevelInput, UpdateClassData } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import {
  countTracks,
  findLevel,
  findLevels,
  findTrack,
  findTracks,
  forceAlternance,
  insertLevel,
  insertTrack,
  levelNameTaken,
  maxLevelPosition,
  refreshPromo,
  setLevelTracks,
  setUserClass,
  trackNameTaken,
  updateLevel,
  updateTrack,
} from "./classes.repo";
import { resolveClass } from "./rules";

export async function listClasses(ctx: Pick<Ctx, "db">): Promise<ClassesDto> {
  const [levels, tracks] = await Promise.all([findLevels(ctx.db), findTracks(ctx.db)]);
  return {
    levels: levels.map((l) => ({ ...l, userCount: Number(l.userCount) })),
    tracks: tracks.map((t) => ({ ...t, userCount: Number(t.userCount) })),
  };
}

const taken = (name: string) => new AppError("ALREADY_EXISTS", 409, `« ${name} » existe déjà.`);
const missing = () => new AppError("NOT_FOUND", 404, "Cette classe n'existe pas.");

async function assertTracksExist(ctx: Pick<Ctx, "db">, trackIds: string[] | undefined) {
  if (trackIds && (await countTracks(ctx.db, [...new Set(trackIds)])) !== new Set(trackIds).size) {
    throw missing();
  }
}

export async function createLevel(ctx: AuthedCtx, input: ClassLevelInput) {
  await assertTracksExist(ctx, input.trackIds);
  await inTransaction(ctx.db, async (tx) => {
    if (await levelNameTaken(tx, input.name)) throw taken(input.name);
    const position = input.position ?? (await maxLevelPosition(tx)) + 10;
    const id = await insertLevel(tx, {
      name: input.name,
      position,
      alternanceOnly: input.alternanceOnly ?? false,
    });
    if (input.trackIds) await setLevelTracks(tx, id, [...new Set(input.trackIds)]);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "class_level.created",
      entity: "class_level",
      entityId: id,
      payload: { name: input.name, alternanceOnly: input.alternanceOnly ?? false },
    });
  });
  return listClasses(ctx);
}

/**
 * Rename, reorder, work-study only or not, programmes offered. The class label of every student
 * of that year follows; an alternance-only year puts all its students in work-study.
 */
export async function editLevel(ctx: AuthedCtx, id: string, input: ClassLevelInput) {
  const before = await findLevel(ctx.db, id);
  if (!before) throw missing();
  await assertTracksExist(ctx, input.trackIds);
  await inTransaction(ctx.db, async (tx) => {
    if (await levelNameTaken(tx, input.name, id)) throw taken(input.name);
    await updateLevel(tx, id, {
      name: input.name,
      ...(input.position === undefined ? {} : { position: input.position }),
      ...(input.alternanceOnly === undefined ? {} : { alternanceOnly: input.alternanceOnly }),
    });
    if (input.trackIds) await setLevelTracks(tx, id, [...new Set(input.trackIds)]);
    const alternanceOnly = input.alternanceOnly ?? before.alternanceOnly;
    if (alternanceOnly && !before.alternanceOnly) await forceAlternance(tx, id);
    if (before.name !== input.name || alternanceOnly !== before.alternanceOnly) {
      await refreshPromo(tx, { levelId: id });
    }
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "class_level.updated",
      entity: "class_level",
      entityId: id,
      payload: {
        from: before.name,
        to: input.name,
        alternanceOnly,
        ...(input.trackIds ? { trackIds: input.trackIds } : {}),
      },
    });
  });
  return listClasses(ctx);
}

export async function createTrack(ctx: AuthedCtx, name: string) {
  await inTransaction(ctx.db, async (tx) => {
    if (await trackNameTaken(tx, name)) throw taken(name);
    const id = await insertTrack(tx, name);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "track.created",
      entity: "track",
      entityId: id,
      payload: { name },
    });
  });
  return listClasses(ctx);
}

export async function editTrack(ctx: AuthedCtx, id: string, name: string) {
  const before = await findTrack(ctx.db, id);
  if (!before) throw missing();
  await inTransaction(ctx.db, async (tx) => {
    if (await trackNameTaken(tx, name, id)) throw taken(name);
    await updateTrack(tx, id, name);
    if (before.name !== name) await refreshPromo(tx, { trackId: id });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "track.updated",
      entity: "track",
      entityId: id,
      payload: { from: before.name, to: name },
    });
  });
  return listClasses(ctx);
}

/** A student's own class. Used by PUT /v1/me/class (me module). */
export async function setOwnClass(ctx: AuthedCtx, input: UpdateClassData): Promise<void> {
  const level = input.levelId ? await findLevel(ctx.db, input.levelId) : null;
  if (input.levelId && !level) throw missing();
  if (input.trackId && !(await findTrack(ctx.db, input.trackId))) throw missing();
  const resolved = resolveClass(level ?? null, input.trackId, input.rhythm);
  if (!resolved.ok) throw new AppError("TRACK_NOT_OFFERED", 422, resolved.message);
  await inTransaction(ctx.db, async (tx) => {
    await setUserClass(tx, ctx.user.id, {
      levelId: input.levelId,
      trackId: input.trackId,
      rhythm: resolved.rhythm,
    });
    await refreshPromo(tx, { userId: ctx.user.id });
  });
}
