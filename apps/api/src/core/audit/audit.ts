import type { DbOrTx } from "../../db/client";
import { auditLog } from "../../db/schema";

export type AuditEntry = {
  actorUserId: string | null;
  /** `entity.verb` in the past tense, e.g. `membership.created`, `open_points.adjusted`. */
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

/** Records a sensitive action. Call it inside the same transaction as the change it describes. */
export async function writeAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    payload: entry.payload ?? null,
  });
}
