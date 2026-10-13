import type { StudyRhythm } from "@bde/shared";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { classLevel, classLevelTrack, track, user } from "../../db/schema";

// Counts qualified by hand: Drizzle may write bare column names inside a sub-select.
const levelTrackIds = sql<
  string[]
>`coalesce((select array_agg(lt."track_id"::text) from "class_level_track" lt where lt."level_id" = "class_level"."id"), '{}')`;

export function findLevels(db: DbOrTx) {
  return db
    .select({
      id: classLevel.id,
      name: classLevel.name,
      position: classLevel.position,
      alternanceOnly: classLevel.alternanceOnly,
      trackIds: levelTrackIds,
      userCount: sql<number>`(select count(*) from "user" u where u."level_id" = "class_level"."id")`,
    })
    .from(classLevel)
    .orderBy(asc(classLevel.position), asc(sql`lower(${classLevel.name})`));
}

export function findTracks(db: DbOrTx) {
  return db
    .select({
      id: track.id,
      name: track.name,
      userCount: sql<number>`(select count(*) from "user" u where u."track_id" = "track"."id")`,
    })
    .from(track)
    .orderBy(asc(sql`lower(${track.name})`));
}

export async function findLevel(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: classLevel.id,
      name: classLevel.name,
      position: classLevel.position,
      alternanceOnly: classLevel.alternanceOnly,
      trackIds: levelTrackIds,
    })
    .from(classLevel)
    .where(eq(classLevel.id, id));
  return row;
}

export async function countTracks(db: DbOrTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(track)
    .where(inArray(track.id, ids));
  return row?.n ?? 0;
}

/** Replaces the programmes offered in a year. */
export async function setLevelTracks(db: DbOrTx, levelId: string, trackIds: string[]) {
  await db.delete(classLevelTrack).where(eq(classLevelTrack.levelId, levelId));
  if (trackIds.length > 0) {
    await db.insert(classLevelTrack).values(trackIds.map((trackId) => ({ levelId, trackId })));
  }
}

/** Every student of an alternance-only year is in work-study. */
export async function forceAlternance(db: DbOrTx, levelId: string) {
  await db.update(user).set({ rhythm: "alternance" }).where(eq(user.levelId, levelId));
}

export async function findTrack(db: DbOrTx, id: string) {
  const [row] = await db.select().from(track).where(eq(track.id, id));
  return row;
}

export async function levelNameTaken(db: DbOrTx, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: classLevel.id })
    .from(classLevel)
    .where(
      sql`lower(${classLevel.name}) = lower(${name})${exceptId ? sql` and ${classLevel.id} <> ${exceptId}` : sql``}`,
    );
  return row !== undefined;
}

export async function trackNameTaken(db: DbOrTx, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: track.id })
    .from(track)
    .where(
      sql`lower(${track.name}) = lower(${name})${exceptId ? sql` and ${track.id} <> ${exceptId}` : sql``}`,
    );
  return row !== undefined;
}

export async function maxLevelPosition(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(${classLevel.position}), 0)` })
    .from(classLevel);
  return Number(row?.n ?? 0);
}

export async function insertLevel(
  db: DbOrTx,
  values: { name: string; position: number; alternanceOnly: boolean },
) {
  const [row] = await db.insert(classLevel).values(values).returning({ id: classLevel.id });
  if (!row) throw new Error("insertLevel: aucune ligne insérée");
  return row.id;
}

export async function updateLevel(
  db: DbOrTx,
  id: string,
  values: { name: string; position?: number; alternanceOnly?: boolean },
) {
  await db.update(classLevel).set(values).where(eq(classLevel.id, id));
}

export async function insertTrack(db: DbOrTx, name: string) {
  const [row] = await db.insert(track).values({ name }).returning({ id: track.id });
  if (!row) throw new Error("insertTrack: aucune ligne insérée");
  return row.id;
}

export async function updateTrack(db: DbOrTx, id: string, name: string) {
  await db.update(track).set({ name }).where(eq(track.id, id));
}

/**
 * Recomputes the class label ("1A · MCSI · Alternance") of the given accounts, or of every account of a level
 * or track after a rename. Same rule as promoLabel in @bde/shared.
 */
export async function refreshPromo(
  db: DbOrTx,
  where: { userId?: string; levelId?: string; trackId?: string },
) {
  const filter = where.userId
    ? sql`u."id" = ${where.userId}`
    : where.levelId
      ? sql`u."level_id" = ${where.levelId}`
      : sql`u."track_id" = ${where.trackId ?? null}`;
  await db.execute(sql`update "user" u set "promo" = nullif(concat_ws(' · ',
      (select l."name" from "class_level" l where l."id" = u."level_id"),
      (select t."name" from "track" t where t."id" = u."track_id"),
      case when coalesce((select l."alternance_only" from "class_level" l where l."id" = u."level_id"), false) then null
        when u."rhythm" = 'initial' then 'Initial'
        when u."rhythm" = 'alternance' then 'Alternance' end), '')
    where ${filter}`);
}

export async function setUserClass(
  db: DbOrTx,
  userId: string,
  values: { levelId: string | null; trackId: string | null; rhythm: StudyRhythm | null },
) {
  await db.update(user).set(values).where(eq(user.id, userId));
}
