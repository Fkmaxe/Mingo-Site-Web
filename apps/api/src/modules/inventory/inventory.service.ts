import {
  type CategoryDto,
  type CheckoutDto,
  type CreateItemInput,
  type InventoryAction,
  type ItemCondition,
  type ItemDto,
  itemCode,
  type LocationDto,
  type MovementDto,
  PHOTO_MAX_BYTES,
  parseItemCode,
} from "@bde/shared";
import { z } from "zod";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { decodeCursor, type Page, PgTimestampText, toPage } from "../../core/http";
import { inTransaction } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { type PhotoStore, sniffPhotoType } from "../../lib/storage";
import { getPole } from "../poles";
import {
  categoryNameTaken,
  findCategories,
  findCategory,
  findCheckout,
  findEventTitle,
  findItem,
  findItems,
  findLocation,
  findLocations,
  findMovements,
  findOpenCheckouts,
  type ItemRow,
  insertCategory,
  insertCheckout,
  insertItem,
  insertLocation,
  insertMovement,
  locationNameTaken,
  lockItem,
  markReturned,
  outQuantityOf,
  updateItem,
} from "./inventory.repo";
import { adjustedQuantity, available, changesOf, checkoutRefusal, isOverdue } from "./rules";

/** Path on the web origin (the web proxies photos: the browser never calls the API). */
export const photoPath = (name: string) => `/inventory/photos/${name}`;

const itemNotFound = () => new AppError("NOT_FOUND", 404, "Cet objet n'existe pas.");

function archivedRefusal() {
  return new AppError(
    "INVALID_STATUS_TRANSITION",
    409,
    "Cet objet est archivé : restaure-le pour le modifier.",
  );
}

async function record(
  db: DbOrTx,
  ctx: AuthedCtx,
  itemId: string,
  action: InventoryAction,
  details: Record<string, unknown> = {},
  note = "",
) {
  await insertMovement(db, { itemId, action, actorUserId: ctx.user.id, details, note });
}

// --- Reading ---

async function toItems(db: DbOrTx, rows: ItemRow[], now: Date): Promise<ItemDto[]> {
  const checkouts = await findOpenCheckouts(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const own: CheckoutDto[] = checkouts
      .filter((c) => c.itemId === r.id)
      .map((c) => ({
        id: c.id,
        quantity: c.quantity,
        holder: c.holder,
        event: c.event?.id ? c.event : null,
        dueAt: c.dueAt?.toISOString() ?? null,
        note: c.note,
        outAt: c.outAt.toISOString(),
        outBy: c.outBy?.id ? c.outBy : null,
        overdue: isOverdue(c.dueAt, now),
      }));
    return {
      id: r.id,
      number: r.number,
      code: itemCode(r.number),
      name: r.name,
      description: r.description,
      category: r.category?.id ? r.category : null,
      kind: r.kind,
      quantity: r.quantity,
      available: available(r.quantity, Number(r.out)),
      condition: r.condition,
      location: r.location?.id ? r.location : null,
      pole: r.pole?.id ? r.pole : null,
      photoUrl: r.photo ? photoPath(r.photo) : null,
      checkouts: own,
      overdue: Boolean(r.overdue),
      archivedAt: r.archivedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
    };
  });
}

export async function listItems(
  ctx: AuthedCtx,
  query: {
    q?: string | undefined;
    locationId?: string | undefined;
    condition?: ItemCondition | undefined;
    categoryId?: string | undefined;
    status: "all" | "available" | "out" | "overdue";
    archived: boolean;
  },
  now: Date = new Date(),
): Promise<ItemDto[]> {
  const q = query.q || undefined;
  const rows = await findItems(
    ctx.db,
    {
      q,
      number: q ? parseItemCode(q) : null,
      locationId: query.locationId,
      condition: query.condition,
      categoryId: query.categoryId,
      status: query.status,
      archived: query.archived,
    },
    now,
  );
  return toItems(ctx.db, rows, now);
}

export async function getItem(ctx: Pick<AuthedCtx, "db">, id: string, now: Date = new Date()) {
  const row = await findItem(ctx.db, id, now);
  if (!row) throw itemNotFound();
  const [dto] = await toItems(ctx.db, [row], now);
  if (!dto) throw itemNotFound();
  return dto;
}

export async function listLocations(ctx: Pick<AuthedCtx, "db">): Promise<LocationDto[]> {
  return (await findLocations(ctx.db)).map((l) => ({ ...l, itemCount: Number(l.itemCount) }));
}

export async function listCategories(ctx: Pick<AuthedCtx, "db">): Promise<CategoryDto[]> {
  return (await findCategories(ctx.db)).map((c) => ({ ...c, itemCount: Number(c.itemCount) }));
}

export async function createCategory(ctx: AuthedCtx, name: string): Promise<CategoryDto[]> {
  await inTransaction(ctx.db, async (tx) => {
    if (await categoryNameTaken(tx, name)) {
      throw new AppError("ALREADY_EXISTS", 409, `La catégorie « ${name} » existe déjà.`);
    }
    await insertCategory(tx, name);
  });
  return listCategories(ctx);
}

// --- Locations ---

export async function createLocation(ctx: AuthedCtx, name: string): Promise<LocationDto[]> {
  await inTransaction(ctx.db, async (tx) => {
    if (await locationNameTaken(tx, name)) {
      throw new AppError("ALREADY_EXISTS", 409, `Le lieu « ${name} » existe déjà.`);
    }
    await insertLocation(tx, name);
  });
  return listLocations(ctx);
}

async function checkRefs(
  ctx: AuthedCtx,
  refs: {
    locationId?: string | null | undefined;
    categoryId?: string | null | undefined;
    poleId?: string | null | undefined;
  },
) {
  if (refs.categoryId && !(await findCategory(ctx.db, refs.categoryId))) {
    throw new AppError("NOT_FOUND", 404, "Cette catégorie n'existe pas.");
  }
  if (refs.locationId && !(await findLocation(ctx.db, refs.locationId))) {
    throw new AppError("NOT_FOUND", 404, "Ce lieu n'existe pas.");
  }
  if (refs.poleId) await getPole(ctx, refs.poleId);
}

async function categoryName(db: DbOrTx, id: unknown): Promise<string | null> {
  return typeof id === "string" ? ((await findCategory(db, id))?.name ?? null) : null;
}

async function locationName(db: DbOrTx, id: string | null): Promise<string | null> {
  return id ? ((await findLocation(db, id))?.name ?? null) : null;
}

// --- Items ---

export async function createItem(
  ctx: AuthedCtx,
  input: z.output<typeof CreateItemInput>,
): Promise<ItemDto> {
  await checkRefs(ctx, input);
  const id = await inTransaction(ctx.db, async (tx) => {
    const itemId = await insertItem(tx, { ...input, createdBy: ctx.user.id });
    await record(tx, ctx, itemId, "created", {
      name: input.name,
      kind: input.kind,
      quantity: input.quantity,
      condition: input.condition,
      location: await locationName(tx, input.locationId),
    });
    return itemId;
  });
  return getItem(ctx, id);
}

export async function editItem(
  ctx: AuthedCtx,
  id: string,
  input: {
    name?: string | undefined;
    description?: string | undefined;
    categoryId?: string | null | undefined;
    condition?: ItemCondition | undefined;
    locationId?: string | null | undefined;
    poleId?: string | null | undefined;
    note: string;
  },
): Promise<ItemDto> {
  const before = await findItem(ctx.db, id);
  if (!before) throw itemNotFound();
  if (before.archivedAt) throw archivedRefusal();
  await checkRefs(ctx, input);
  const { note, ...values } = input;
  const changes = changesOf(before, values);
  await inTransaction(ctx.db, async (tx) => {
    const set = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    await updateItem(tx, id, { ...set, updatedAt: new Date() });
    if (changes.moved) {
      await record(
        tx,
        ctx,
        id,
        "moved",
        {
          from: await locationName(tx, changes.moved.from),
          to: await locationName(tx, changes.moved.to),
        },
        note,
      );
    }
    if (changes.condition) await record(tx, ctx, id, "condition_changed", changes.condition, note);
    if (Object.keys(changes.fields).length > 0) {
      // Category names, not ids, so the history stays readable.
      const { categoryId, ...fields } = changes.fields;
      const details = categoryId
        ? {
            ...fields,
            category: {
              from: await categoryName(tx, categoryId.from),
              to: await categoryName(tx, categoryId.to),
            },
          }
        : fields;
      await record(tx, ctx, id, "updated", details, note);
    }
  });
  return getItem(ctx, id);
}

export async function adjustQuantity(
  ctx: AuthedCtx,
  id: string,
  input: { delta: number; note: string },
): Promise<ItemDto> {
  await inTransaction(ctx.db, async (tx) => {
    const item = await lockItem(tx, id);
    if (!item) throw itemNotFound();
    if (item.archivedAt) throw archivedRefusal();
    if (item.kind !== "stock") {
      throw new AppError("VALIDATION_ERROR", 400, "Seul un stock a une quantité à ajuster.");
    }
    const next = adjustedQuantity(item.quantity, await outQuantityOf(tx, id), input.delta);
    if ("refusal" in next) throw new AppError("NOT_AVAILABLE", 409, next.refusal);
    await updateItem(tx, id, { quantity: next.quantity, updatedAt: new Date() });
    await record(
      tx,
      ctx,
      id,
      "quantity_adjusted",
      { from: item.quantity, to: next.quantity, delta: input.delta },
      input.note,
    );
  });
  return getItem(ctx, id);
}

// --- Checkouts ---

export async function checkoutItem(
  ctx: AuthedCtx,
  id: string,
  input: {
    quantity: number;
    holder: string;
    eventId: string | null;
    dueAt: string | null;
    note: string;
  },
): Promise<ItemDto> {
  const eventTitle = input.eventId ? await findEventTitle(ctx.db, input.eventId) : null;
  if (input.eventId && !eventTitle)
    throw new AppError("NOT_FOUND", 404, "Cet événement n'existe pas.");
  await inTransaction(ctx.db, async (tx) => {
    const item = await lockItem(tx, id);
    if (!item) throw itemNotFound();
    if (item.archivedAt) throw archivedRefusal();
    const refusal = checkoutRefusal(item, await outQuantityOf(tx, id), input.quantity);
    if (refusal) throw new AppError("NOT_AVAILABLE", 409, refusal);
    const checkoutId = await insertCheckout(tx, {
      itemId: id,
      quantity: input.quantity,
      holder: input.holder,
      eventId: input.eventId,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      note: input.note,
      outBy: ctx.user.id,
    });
    await record(
      tx,
      ctx,
      id,
      "checked_out",
      {
        checkoutId,
        quantity: input.quantity,
        holder: input.holder,
        event: eventTitle,
        dueAt: input.dueAt,
      },
      input.note,
    );
  });
  return getItem(ctx, id);
}

/** Back in: the state it came back in is recorded (and becomes the state of a unique item). */
export async function returnCheckout(
  ctx: AuthedCtx,
  checkoutId: string,
  input: { condition: ItemCondition; note: string },
): Promise<ItemDto> {
  const checkout = await findCheckout(ctx.db, checkoutId);
  if (!checkout) throw new AppError("NOT_FOUND", 404, "Cette sortie n'existe pas.");
  if (checkout.returnedAt) {
    throw new AppError("INVALID_STATUS_TRANSITION", 409, "Déjà rendu.");
  }
  await inTransaction(ctx.db, async (tx) => {
    const item = await lockItem(tx, checkout.itemId);
    if (!item) throw itemNotFound();
    const before = await findItem(tx, checkout.itemId);
    await markReturned(tx, checkoutId, {
      returnedAt: new Date(),
      returnedBy: ctx.user.id,
      returnCondition: input.condition,
    });
    await record(
      tx,
      ctx,
      checkout.itemId,
      "returned",
      {
        checkoutId,
        quantity: checkout.quantity,
        holder: checkout.holder,
        condition: input.condition,
      },
      input.note,
    );
    if (item.kind === "unique" && before && before.condition !== input.condition) {
      await updateItem(tx, checkout.itemId, { condition: input.condition, updatedAt: new Date() });
      await record(tx, ctx, checkout.itemId, "condition_changed", {
        from: before.condition,
        to: input.condition,
      });
    }
  });
  return getItem(ctx, checkout.itemId);
}

// --- Archive ---

/** Leaves the list, keeps its history. Refused while something is out. Audited. */
export async function archiveItem(ctx: AuthedCtx, id: string, note: string): Promise<ItemDto> {
  await inTransaction(ctx.db, async (tx) => {
    const item = await lockItem(tx, id);
    if (!item) throw itemNotFound();
    if (item.archivedAt) return;
    if ((await outQuantityOf(tx, id)) > 0) {
      throw new AppError("NOT_AVAILABLE", 409, "Une partie est sortie : fais-la rendre d'abord.");
    }
    await updateItem(tx, id, { archivedAt: new Date() });
    await record(tx, ctx, id, "archived", {}, note);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "inventory.archived",
      entity: "inventory_item",
      entityId: id,
      payload: note ? { note } : {},
    });
  });
  return getItem(ctx, id);
}

export async function restoreItem(ctx: AuthedCtx, id: string): Promise<ItemDto> {
  await inTransaction(ctx.db, async (tx) => {
    const item = await lockItem(tx, id);
    if (!item) throw itemNotFound();
    if (!item.archivedAt) return;
    await updateItem(tx, id, { archivedAt: null });
    await record(tx, ctx, id, "restored");
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "inventory.restored",
      entity: "inventory_item",
      entityId: id,
    });
  });
  return getItem(ctx, id);
}

// --- Photos ---

export async function setPhoto(
  ctx: AuthedCtx,
  photos: PhotoStore,
  id: string,
  bytes: Uint8Array,
): Promise<ItemDto> {
  if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new AppError("VALIDATION_ERROR", 400, "La photo doit faire moins de 3 Mo.");
  }
  const type = sniffPhotoType(bytes);
  if (!type) throw new AppError("VALIDATION_ERROR", 400, "Envoie une photo JPEG, PNG ou WebP.");
  const before = await findItem(ctx.db, id);
  if (!before) throw itemNotFound();
  if (before.archivedAt) throw archivedRefusal();
  const name = await photos.save(bytes, type);
  try {
    await inTransaction(ctx.db, async (tx) => {
      await updateItem(tx, id, { photo: name, updatedAt: new Date() });
      await record(tx, ctx, id, "photo_changed", { photo: before.photo ? "remplacée" : "ajoutée" });
    });
  } catch (error) {
    await photos.remove(name);
    throw error;
  }
  if (before.photo) await photos.remove(before.photo);
  return getItem(ctx, id);
}

export async function removePhoto(
  ctx: AuthedCtx,
  photos: PhotoStore,
  id: string,
): Promise<ItemDto> {
  const before = await findItem(ctx.db, id);
  if (!before) throw itemNotFound();
  if (!before.photo) return getItem(ctx, id);
  await inTransaction(ctx.db, async (tx) => {
    await updateItem(tx, id, { photo: null, updatedAt: new Date() });
    await record(tx, ctx, id, "photo_changed", { photo: "retirée" });
  });
  await photos.remove(before.photo);
  return getItem(ctx, id);
}

// --- History ---

const HistoryCursor = z.object({ c: PgTimestampText, id: z.uuid() });

export async function listHistory(
  ctx: Pick<AuthedCtx, "db">,
  query: { itemId?: string | undefined; cursor?: string | undefined; limit: number },
): Promise<Page<MovementDto>> {
  const after = query.cursor ? decodeCursor(query.cursor, HistoryCursor) : null;
  const rows = await findMovements(ctx.db, {
    itemId: query.itemId ?? null,
    after: after ? { createdAtKey: after.c, id: after.id } : null,
    limit: query.limit,
  });
  return toPage(
    rows,
    query.limit,
    ({ createdAtKey: _, actor, item, ...row }) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      actor: actor?.id ? actor : null,
      item: { id: item.id, code: itemCode(item.number), name: item.name },
    }),
    (row) => ({ c: row.createdAtKey, id: row.id }),
  );
}
