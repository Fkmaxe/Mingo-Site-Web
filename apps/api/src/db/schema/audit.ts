import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id } from "./columns";

/** Append-only. Never updated nor deleted by the application. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_actor_user_id_idx").on(t.actorUserId),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
  ],
);
