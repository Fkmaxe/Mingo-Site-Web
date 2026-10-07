import { describe, expect, it } from "vitest";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createUser } from "../../test/factories";
import { writeAudit } from "./audit";

describe("writeAudit", () => {
  it("appends an entry", async () => {
    const actor = await createUser();
    await writeAudit(getTestDb(), {
      actorUserId: actor.id,
      action: "membership.created",
      entity: "membership",
      entityId: "abc",
      payload: { role: "member" },
    });
    const rows = await getTestDb().select().from(auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: actor.id,
      action: "membership.created",
      payload: { role: "member" },
    });
  });
});
