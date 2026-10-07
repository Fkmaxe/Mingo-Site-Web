import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid().primaryKey().defaultRandom();

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** Nullable, set by Drizzle on every update (docs/data-model.md). */
export const updatedAt = () => timestamp({ withTimezone: true }).$onUpdate(() => new Date());
