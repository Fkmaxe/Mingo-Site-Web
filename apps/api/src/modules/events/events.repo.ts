import type { EventVisibility } from "@bde/shared";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, type SQL, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { compact, type Patch } from "../../db/patch";
import { event, pole } from "../../db/schema";

export type EventRow = typeof event.$inferSelect & {
  pole: { id: string; slug: string; name: string };
};

/** What the current user may see: published-like events by visibility, drafts by managed poles. */
export type EventVisibilityFilter = {
  visibilities: EventVisibility[];
  /** `"all"` (board) or the ids of the poles whose drafts are visible. */
  draftPoles: "all" | string[];
};

function visibleWhere(filter: EventVisibilityFilter): SQL | undefined {
  const nonDraft = and(ne(event.status, "draft"), inArray(event.visibility, filter.visibilities));
  const draft =
    filter.draftPoles === "all"
      ? eq(event.status, "draft")
      : filter.draftPoles.length > 0
        ? and(eq(event.status, "draft"), inArray(event.poleId, filter.draftPoles))
        : undefined;
  return draft ? or(nonDraft, draft) : nonDraft;
}

/** Rows a manager can manage: every event (`"all"`) or those of the given poles. */
function manageableWhere(poles: "all" | string[]): SQL | undefined {
  if (poles === "all") return undefined;
  return poles.length > 0 ? inArray(event.poleId, poles) : sql`false`;
}

/** Rows strictly after the cursor in (starts_at, id) order. */
function keysetCondition(op: ">" | "<", after: { startsAt: Date; id: string }): SQL {
  // Raw SQL parameters are not serialized by type: pass the date as ISO text.
  const startsAt = sql`${after.startsAt.toISOString()}::timestamptz`;
  const tuple = sql`(${event.startsAt}, ${event.id})`;
  const cursor = sql`(${startsAt}, ${after.id}::uuid)`;
  return op === ">" ? sql`${tuple} > ${cursor}` : sql`${tuple} < ${cursor}`;
}

const selection = {
  event,
  pole: { id: pole.id, slug: pole.slug, name: pole.name },
};

function toRow(r: { event: typeof event.$inferSelect; pole: EventRow["pole"] }): EventRow {
  return { ...r.event, pole: r.pole };
}

export async function findEvents(
  db: DbOrTx,
  params: {
    filter: EventVisibilityFilter;
    manageablePoles: "all" | string[] | null;
    scope: "upcoming" | "past";
    poleId: string | undefined;
    now: Date;
    after: { startsAt: Date; id: string } | null;
    limit: number;
  },
): Promise<EventRow[]> {
  const upcoming = params.scope === "upcoming";
  const conditions: (SQL | undefined)[] = [
    isNull(event.deletedAt),
    params.manageablePoles === null
      ? visibleWhere(params.filter)
      : manageableWhere(params.manageablePoles),
    upcoming ? gte(event.endsAt, params.now) : lt(event.endsAt, params.now),
    params.poleId ? eq(event.poleId, params.poleId) : undefined,
    params.after ? keysetCondition(upcoming ? ">" : "<", params.after) : undefined,
  ];
  const order = upcoming
    ? [asc(event.startsAt), asc(event.id)]
    : [desc(event.startsAt), desc(event.id)];
  const rows = await db
    .select(selection)
    .from(event)
    .innerJoin(pole, eq(pole.id, event.poleId))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(params.limit + 1);
  return rows.map(toRow);
}

export async function findEventByRef(db: DbOrTx, ref: { id: string } | { slug: string }) {
  const [row] = await db
    .select(selection)
    .from(event)
    .innerJoin(pole, eq(pole.id, event.poleId))
    .where(
      and(isNull(event.deletedAt), "id" in ref ? eq(event.id, ref.id) : eq(event.slug, ref.slug)),
    );
  return row ? toRow(row) : undefined;
}

export async function slugExists(db: DbOrTx, slug: string): Promise<boolean> {
  // Deleted events keep their slug: the unique constraint covers them too.
  const [row] = await db.select({ id: event.id }).from(event).where(eq(event.slug, slug));
  return row !== undefined;
}

export async function insertEvent(db: DbOrTx, values: typeof event.$inferInsert) {
  const [row] = await db.insert(event).values(values).returning({ id: event.id });
  if (!row) throw new Error("insertEvent: aucune ligne insérée");
  return row.id;
}

export async function updateEvent(
  db: DbOrTx,
  eventId: string,
  values: Patch<typeof event.$inferInsert>,
) {
  const changes = compact(values);
  if (!changes) return;
  await db.update(event).set(changes).where(eq(event.id, eventId));
}
