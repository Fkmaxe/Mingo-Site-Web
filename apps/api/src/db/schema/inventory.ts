import { INVENTORY_ACTIONS, ITEM_CONDITIONS, ITEM_KINDS } from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { event } from "./events";
import { pole } from "./organization";

export const itemCondition = pgEnum("item_condition", ITEM_CONDITIONS);
export const itemKind = pgEnum("item_kind", ITEM_KINDS);
export const inventoryAction = pgEnum("inventory_action", INVENTORY_ACTIONS);

/** Where things are kept (BDE room, cellar, a member's car…). */
export const inventoryLocation = pgTable(
  "inventory_location",
  {
    id: id(),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("inventory_location_name_unique").on(sql`lower(${t.name})`)],
);

export const inventoryItem = pgTable(
  "inventory_item",
  {
    id: id(),
    /** Short number written on the label (INV-0042), never reused. */
    number: serial().notNull().unique("inventory_item_number_unique"),
    name: text().notNull(),
    description: text().notNull().default(""),
    category: text(),
    kind: itemKind().notNull().default("unique"),
    /** 1 for a unique item. */
    quantity: integer().notNull().default(1),
    condition: itemCondition().notNull().default("good"),
    locationId: uuid().references(() => inventoryLocation.id, { onDelete: "set null" }),
    /** Pole it mostly belongs to (optional). */
    poleId: uuid().references(() => pole.id, { onDelete: "set null" }),
    /** File name in the uploads directory. */
    photo: text(),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** Archived items leave the list but keep their history. */
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("inventory_item_location_id_idx").on(t.locationId),
    index("inventory_item_pole_id_idx").on(t.poleId),
    check("inventory_item_quantity_check", sql`${t.quantity} >= 0`),
    check("inventory_item_unique_quantity_check", sql`${t.kind} = 'stock' or ${t.quantity} = 1`),
  ],
);

/** An item (or part of a stock) taken out: for whom, for what, back when. */
export const inventoryCheckout = pgTable(
  "inventory_checkout",
  {
    id: id(),
    itemId: uuid()
      .notNull()
      .references(() => inventoryItem.id, { onDelete: "cascade" }),
    quantity: integer().notNull().default(1),
    /** Who has it: a person (free text, may be outside the BDE). */
    holder: text().notNull(),
    eventId: uuid().references(() => event.id, { onDelete: "set null" }),
    dueAt: timestamp({ withTimezone: true }),
    note: text().notNull().default(""),
    outAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    outBy: uuid().references(() => user.id, { onDelete: "set null" }),
    returnedAt: timestamp({ withTimezone: true }),
    returnedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    returnCondition: itemCondition(),
  },
  (t) => [
    index("inventory_checkout_item_id_idx").on(t.itemId),
    check("inventory_checkout_quantity_check", sql`${t.quantity} > 0`),
    // Open (returnedAt null) or returned with the state it came back in.
    check(
      "inventory_checkout_returned_check",
      sql`(${t.returnedAt} is null) = (${t.returnCondition} is null)`,
    ),
    index("inventory_checkout_open_idx").on(t.itemId).where(sql`${t.returnedAt} is null`),
  ],
);

/** Append-only history of everything done to the inventory. Never updated nor deleted. */
export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: id(),
    itemId: uuid()
      .notNull()
      .references(() => inventoryItem.id, { onDelete: "cascade" }),
    action: inventoryAction().notNull(),
    actorUserId: uuid().references(() => user.id, { onDelete: "set null" }),
    /** What changed: { from, to } values, checkout details… */
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    note: text().notNull().default(""),
    // Real clock, not now(): entries of one transaction keep the order they were written in.
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [
    index("inventory_movement_item_id_idx").on(t.itemId, t.createdAt),
    index("inventory_movement_created_at_idx").on(t.createdAt),
  ],
);
