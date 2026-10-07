import type { DbOrTx, Tx } from "../db/client";

/** Registers work to run once the transaction has committed (mails, notifications…). */
export type Defer = (effect: () => Promise<void>) => void;

/** Runs `fn` in a transaction (a savepoint when `db` already is a transaction). */
export function inTransaction<T>(db: DbOrTx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/**
 * Like `inTransaction`, plus effects deferred until after the commit: nothing is announced
 * for a change that was rolled back. A failing effect is logged and does not fail the request.
 * Nested in an outer transaction, effects run after this savepoint, not the outer commit.
 */
export async function inTransactionWithEffects<T>(
  db: DbOrTx,
  fn: (tx: Tx, defer: Defer) => Promise<T>,
): Promise<T> {
  const effects: (() => Promise<void>)[] = [];
  const result = await db.transaction((tx) => fn(tx, (effect) => effects.push(effect)));
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      console.error("Effet après commit en échec", error);
    }
  }
  return result;
}
