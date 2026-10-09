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
  inventoryCategory,
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
      // Qualified by hand: inside a sub-select Drizzle writes bare column names.
      itemCount: sql<number>`(select count(*) from "inventory_item" i
        where i."location_id" = "inventory_location"."id" and i."archived_at" is null)`,
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

// Sub-selects qualified by hand (Drizzle may write bare column names in them).
const outQuantity = sql<number>`coalesce((select sum(c."quantity") from "inventory_checkout" c
  where c."item_id" = "inventory_item"."id" and c."returned_at" is null), 0)`;

const overdue = (now: Date) => sql<boolean>`exists (select 1 from "inventory_checkout" c
  where c."item_id" = "inventory_item"."id" and c."returned_at" is null
    and c."due_at" < ${now.toISOString()}::timestamptz)`;

const itemSelection = (now: Date) => ({
  id: inventoryItem.id,
  number: inventoryItem.number,
  name: inventoryItem.name,
  description: inventoryItem.description,
  categoryId: inventoryItem.categoryId,
  category: { id: inventoryCategory.id, name: inventoryCategory.name },
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
    categoryId: string | undefined;
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
          ilike(inventoryCategory.name, contains(filters.q)),
        )
      : undefined,
    filters.locationId ? eq(inventoryItem.locationId, filters.locationId) : undefined,
    filters.condition ? eq(inventoryItem.condition, filters.condition) : undefined,
    filters.categoryId ? eq(inventoryItem.categoryId, filters.categoryId) : undefined,
    filters.status === "available" ? sql`${inventoryItem.quantity} > ${outQuantity}` : undefined,
    filters.status === "out" ? sql`${outQuantity} > 0` : undefined,
    filters.status === "overdue" ? overdue(now) : undefined,
  ];
  return db
    .select(itemSelection(now))
    .from(inventoryItem)
    .leftJoin(inventoryLocation, eq(inventoryLocation.id, inventoryItem.locationId))
    .leftJoin(inventoryCategory, eq(inventoryCategory.id, inventoryItem.categoryId))
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
    .leftJoin(inventoryCategory, eq(inventoryCategory.id, inventoryItem.categoryId))
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

// --- Categories (same shape as locations) ---

export function findCategories(db: DbOrTx) {
  return db
    .select({
      id: inventoryCategory.id,
      name: inventoryCategory.name,
      // Qualified by hand: inside a sub-select Drizzle writes bare column names.
      itemCount: sql<number>`(select count(*) from "inventory_item" i
        where i."category_id" = "inventory_category"."id" and i."archived_at" is null)`,
    })
    .from(inventoryCategory)
    .orderBy(asc(sql`lower(${inventoryCategory.name})`));
}

export async function findCategory(db: DbOrTx, id: string) {
  const [row] = await db.select().from(inventoryCategory).where(eq(inventoryCategory.id, id));
  return row;
}

export async function categoryNameTaken(db: DbOrTx, name: string) {
  const [row] = await db
    .select({ id: inventoryCategory.id })
    .from(inventoryCategory)
    .where(sql`lower(${inventoryCategory.name}) = lower(${name})`);
  return row !== undefined;
}

export async function insertCategory(db: DbOrTx, name: string) {
  const [row] = await db
    .insert(inventoryCategory)
    .values({ name })
    .returning({ id: inventoryCategory.id });
  if (!row) throw new Error("insertCategory: aucune ligne insérée");
  return row.id;
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
