import { PARTNER_STATUSES } from "@bde/shared";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { membership } from "./organization";

export const partnerStatus = pgEnum("partner_status", PARTNER_STATUSES);

export const partner = pgTable(
  "partner",
  {
    id: id(),
    name: text().notNull(),
    website: text(),
    contactName: text().notNull().default(""),
    contactEmail: text(),
    status: partnerStatus().notNull().default("prospect"),
    benefits: text().notNull().default(""),
    notes: text().notNull().default(""),
    ownerMembershipId: uuid().references(() => membership.id, { onDelete: "set null" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("partner_status_idx").on(t.status),
    index("partner_owner_membership_id_idx").on(t.ownerMembershipId),
    index("partner_created_by_idx").on(t.createdBy),
  ],
);
