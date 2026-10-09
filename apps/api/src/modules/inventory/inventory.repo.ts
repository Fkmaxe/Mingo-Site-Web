import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbOrTx } from "../../db/client";
import {
  event,
  inventoryCheckout,
  inventoryItem,
  inventoryLocation,
  inventoryMovement,
  pole,
  user,
} from "../../db/schema";

// --- Locations ---

export function findLocations(db: DbOrTx) {
  return db
    .select({
      id: inventoryLocation.id,
      name: inventoryLocation.name,
      itemCount: sql<number>`(select count(*) from ${inventoryItem}
        where ${inventoryItem.locationId} = ${inventoryLocation.id} and ${inventoryItem.archivedAt} is null)`,
    })
    .from(inventoryLocation)
    .orderBy(asc(sql`lower(${inventoryLocation.name})`));
}

export async function findLocation(db: DbOrTx, id: string) {
  const [row] = await db.select().from(inventoryLocation).where(eq(inventoryLocation.id, id));
  return row;
}

export async function locationNameTaken(db: DbOrTx, name: string) {
  const [row] = await db
    .select({ id: inventoryLocation.id })
    .from(inventoryLocation)
    .where(sql`lower(${inventoryLocation.name}) = lower(${name})`);
  return row !== undefined;
}

export async function insertLocation(db: DbOrTx, name: string) {
  const [row] = await db
    .insert(inventoryLocation)
    .values({ name })
    .returning({ id: inventoryLocation.id });
  if (!row) throw new Error("insertLocation: aucune ligne insérée");
  return row.id;
}

// --- Items ---

const outQuantity = sql<number>`coalesce((select sum(${inventoryCheckout.quantity}) from ${inventoryCheckout}
  where ${inventoryCheckout.itemId} = ${inventoryItem.id} and ${inventoryCheckout.returnedAt} is null), 0)`;

const overdue = (now: Date) => sql<boolean>`exists (select 1 from ${inventoryCheckout}
  where ${inventoryCheckout.itemId} = ${inventoryItem.id} and ${inventoryCheckout.returnedAt} is null
    and ${inventoryCheckout.dueAt} < ${now.toISOString()}::timestamptz)`;

const itemSelection = (now: Date) => ({
  id: inventoryItem.id,
  number: inventoryItem.number,
  name: inventoryItem.name,
  description: inventoryItem.description,
  category: inventoryItem.category,
  kind: inventoryItem.kind,
  quantity: inventoryItem.quantity,
  condition: inventoryItem.condition,
  photo: inventoryItem.photo,
  archivedAt: inventoryItem.archivedAt,
  createdAt: inventoryItem.createdAt,
  updatedAt: inventoryItem.updatedAt,
  locationId: inventoryItem.locationId,
  poleId: inventoryItem.poleId,
  location: { id: inventoryLocation.id, name: inventoryLocation.name },
  pole: { id: pole.id, name: pole.name },
  out: outQuantity,
  overdue: overdue(now),
});

export type ItemRow = Awaited<ReturnType<typeof findItem>> & {};

function contains(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function findItems(
  db: DbOrTx,
  filters: {
    q: string | undefined;
    number: number | null;
    locationId: string | undefined;
    condition: (typeof inventoryItem.$inferSelect)["condition"] | undefined;
    category: string | undefined;
    status: "all" | "available" | "out" | "overdue";
    archived: boolean;
  },
  now: Date,
) {
  const conditions: (SQL | undefined)[] = [
    filters.archived ? isNotNull(inventoryItem.archivedAt) : isNull(inventoryItem.archivedAt),
    filters.q
      ? or(
          filters.number !== null ? eq(inventoryItem.number, filters.number) : undefined,
          ilike(inventoryItem.name, contains(filters.q)),
          ilike(inventoryItem.description, contains(filters.q)),
          ilike(inventoryItem.category, contains(filters.q)),
        )
      : undefined,
    filters.locationId ? eq(inventoryItem.locationId, filters.locationId) : undefined,
    filters.condition ? eq(inventoryItem.condition, filters.condition) : undefined,
    filters.category
      ? sql`lower(${inventoryItem.category}) = lower(${filters.category})`
      : undefined,
    filters.status === "available" ? sql`${inventoryItem.quantity} > ${outQuantity}` : undefined,
    filters.status === "out" ? sql`${outQuantity} > 0` : undefined,
    filters.status === "overdue" ? overdue(now) : undefined,
  ];
  return db
    .select(itemSelection(now))
    .from(inventoryItem)
    .leftJoin(inventoryLocation, eq(inventoryLocation.id, inventoryItem.locationId))
    .leftJoin(pole, eq(pole.id, inventoryItem.poleId))
    .where(and(...conditions))
    .orderBy(asc(sql`lower(${inventoryItem.name})`), asc(inventoryItem.number))
    .limit(500);
}

export async function findItem(db: DbOrTx, id: string, now: Date = new Date()) {
  const [row] = await db
    .select(itemSelection(now))
    .from(inventoryItem)
    .leftJoin(inventoryLocation, eq(inventoryLocation.id, inventoryItem.locationId))
    .leftJoin(pole, eq(pole.id, inventoryItem.poleId))
    .where(eq(inventoryItem.id, id));
  return row;
}

/** Serializes the changes of one item (quantities, checkouts) until the end of the transaction. */
export async function lockItem(tx: DbOrTx, id: string) {
  const [row] = await tx
    .select({
      id: inventoryItem.id,
      kind: inventoryItem.kind,
      quantity: inventoryItem.quantity,
      archivedAt: inventoryItem.archivedAt,
    })
    .from(inventoryItem)
    .where(eq(inventoryItem.id, id))
    .for("update");
  return row;
}

export async function outQuantityOf(db: DbOrTx, itemId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${inventoryCheckout.quantity}), 0)` })
    .from(inventoryCheckout)
    .where(and(eq(inventoryCheckout.itemId, itemId), isNull(inventoryCheckout.returnedAt)));
  return Number(row?.n ?? 0);
}

export async function insertItem(db: DbOrTx, values: typeof inventoryItem.$inferInsert) {
  const [row] = await db.insert(inventoryItem).values(values).returning({ id: inventoryItem.id });
  if (!row) throw new Error("insertItem: aucune ligne insérée");
  return row.id;
}

export async function updateItem(
  db: DbOrTx,
  id: string,
  values: Partial<typeof inventoryItem.$inferInsert>,
) {
  if (Object.keys(values).length === 0) return;
  await db.update(inventoryItem).set(values).where(eq(inventoryItem.id, id));
}

export function findCategories(db: DbOrTx) {
  return db
    .selectDistinct({ category: inventoryItem.category })
    .from(inventoryItem)
    .where(and(isNotNull(inventoryItem.category), isNull(inventoryItem.archivedAt)))
    .orderBy(asc(inventoryItem.category));
}

// --- Checkouts ---

const outByUser = alias(user, "out_by_user");

export function findOpenCheckouts(db: DbOrTx, itemIds: string[]) {
  if (itemIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      id: inventoryCheckout.id,
      itemId: inventoryCheckout.itemId,
      quantity: inventoryCheckout.quantity,
      holder: inventoryCheckout.holder,
      dueAt: inventoryCheckout.dueAt,
      note: inventoryCheckout.note,
      outAt: inventoryCheckout.outAt,
      event: { id: event.id, title: event.title },
      outBy: { id: outByUser.id, name: outByUser.name },
    })
    .from(inventoryCheckout)
    .leftJoin(event, eq(event.id, inventoryCheckout.eventId))
    .leftJoin(outByUser, eq(outByUser.id, inventoryCheckout.outBy))
    .where(and(inArray(inventoryCheckout.itemId, itemIds), isNull(inventoryCheckout.returnedAt)))
    .orderBy(asc(inventoryCheckout.outAt));
}

export async function insertCheckout(db: DbOrTx, values: typeof inventoryCheckout.$inferInsert) {
  const [row] = await db
    .insert(inventoryCheckout)
    .values(values)
    .returning({ id: inventoryCheckout.id });
  if (!row) throw new Error("insertCheckout: aucune ligne insérée");
  return row.id;
}

export async function findCheckout(db: DbOrTx, id: string) {
  const [row] = await db.select().from(inventoryCheckout).where(eq(inventoryCheckout.id, id));
  return row;
}

export async function markReturned(
  db: DbOrTx,
  id: string,
  values: {
    returnedAt: Date;
    returnedBy: string;
    returnCondition: (typeof inventoryItem.$inferSelect)["condition"];
  },
) {
  await db
    .update(inventoryCheckout)
    .set(values)
    .where(and(eq(inventoryCheckout.id, id), isNull(inventoryCheckout.returnedAt)));
}

export async function findEventTitle(db: DbOrTx, eventId: string) {
  const [row] = await db
    .select({ title: event.title })
    .from(event)
    .where(and(eq(event.id, eventId), isNull(event.deletedAt)));
  return row?.title;
}

// --- History ---

export async function insertMovement(db: DbOrTx, values: typeof inventoryMovement.$inferInsert) {
  await db.insert(inventoryMovement).values(values);
}

export function findMovements(
  db: DbOrTx,
  params: {
    itemId: string | null;
    after: { createdAtKey: string; id: string } | null;
    limit: number;
  },
) {
  return db
    .select({
      id: inventoryMovement.id,
      action: inventoryMovement.action,
      details: inventoryMovement.details,
      note: inventoryMovement.note,
      createdAt: inventoryMovement.createdAt,
      createdAtKey: sql<string>`${inventoryMovement.createdAt}::text`,
      actor: { id: user.id, name: user.name },
      item: { id: inventoryItem.id, number: inventoryItem.number, name: inventoryItem.name },
    })
    .from(inventoryMovement)
    .innerJoin(inventoryItem, eq(inventoryItem.id, inventoryMovement.itemId))
    .leftJoin(user, eq(user.id, inventoryMovement.actorUserId))
    .where(
      and(
        params.itemId ? eq(inventoryMovement.itemId, params.itemId) : undefined,
        params.after
          ? sql`(${inventoryMovement.createdAt}, ${inventoryMovement.id}) < (${params.after.createdAtKey}::timestamptz, ${params.after.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(inventoryMovement.createdAt), desc(inventoryMovement.id))
    .limit(params.limit + 1);
}
