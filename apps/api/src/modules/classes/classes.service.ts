import type { ClassesDto } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import {
  findLevel,
  findLevels,
  findTrack,
  findTracks,
  insertLevel,
  insertTrack,
  levelNameTaken,
  maxLevelPosition,
  refreshPromo,
  setUserClass,
  trackNameTaken,
  updateLevel,
  updateTrack,
} from "./classes.repo";

export async function listClasses(ctx: Pick<Ctx, "db">): Promise<ClassesDto> {
  const [levels, tracks] = await Promise.all([findLevels(ctx.db), findTracks(ctx.db)]);
  return {
    levels: levels.map((l) => ({ ...l, userCount: Number(l.userCount) })),
    tracks: tracks.map((t) => ({ ...t, userCount: Number(t.userCount) })),
  };
}

const taken = (name: string) => new AppError("ALREADY_EXISTS", 409, `« ${name} » existe déjà.`);
const missing = () => new AppError("NOT_FOUND", 404, "Cette classe n'existe pas.");

export async function createLevel(
  ctx: AuthedCtx,
  input: { name: string; position?: number | undefined },
) {
  await inTransaction(ctx.db, async (tx) => {
    if (await levelNameTaken(tx, input.name)) throw taken(input.name);
    const position = input.position ?? (await maxLevelPosition(tx)) + 10;
    const id = await insertLevel(tx, { name: input.name, position });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "class_level.created",
      entity: "class_level",
      entityId: id,
      payload: { name: input.name },
    });
  });
  return listClasses(ctx);
}

/** Rename or reorder; the class label of every student of that level follows. */
export async function editLevel(
  ctx: AuthedCtx,
  id: string,
  input: { name: string; position?: number | undefined },
) {
  const before = await findLevel(ctx.db, id);
  if (!before) throw missing();
  await inTransaction(ctx.db, async (tx) => {
    if (await levelNameTaken(tx, input.name, id)) throw taken(input.name);
    await updateLevel(tx, id, {
      name: input.name,
      ...(input.position === undefined ? {} : { position: input.position }),
    });
    if (before.name !== input.name) await refreshPromo(tx, { levelId: id });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "class_level.updated",
      entity: "class_level",
      entityId: id,
      payload: { from: before.name, to: input.name },
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
export async function setOwnClass(
  ctx: AuthedCtx,
  input: { levelId: string | null; trackId: string | null },
): Promise<void> {
  if (input.levelId && !(await findLevel(ctx.db, input.levelId))) throw missing();
  if (input.trackId && !(await findTrack(ctx.db, input.trackId))) throw missing();
  await inTransaction(ctx.db, async (tx) => {
    await setUserClass(tx, ctx.user.id, input);
    await refreshPromo(tx, { userId: ctx.user.id });
  });
}
