import { describe, expect, it, vi } from "vitest";
import { pole } from "../db/schema";
import { getTestDb } from "../test/db";
import { inTransactionWithEffects } from "./tx";

describe("inTransactionWithEffects", () => {
  it("runs deferred effects after the commit, in order", async () => {
    const order: string[] = [];
    await inTransactionWithEffects(getTestDb(), async (tx, defer) => {
      defer(async () => {
        order.push(`effect sees ${(await getTestDb().select().from(pole)).length} pole`);
      });
      await tx.insert(pole).values({ slug: "sport", name: "Sport" });
      order.push("body");
    });
    expect(order).toEqual(["body", "effect sees 1 pole"]);
  });

  it("drops the effects of a rolled back transaction", async () => {
    const effect = vi.fn(async () => {});
    await expect(
      inTransactionWithEffects(getTestDb(), async (_tx, defer) => {
        defer(effect);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(effect).not.toHaveBeenCalled();
  });

  it("logs a failing effect without failing the operation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await inTransactionWithEffects(getTestDb(), async (_tx, defer) => {
      defer(async () => {
        throw new Error("smtp down");
      });
      return 42;
    });
    expect(result).toBe(42);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
