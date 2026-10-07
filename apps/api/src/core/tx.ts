import type { DbOrTx, Tx } from "../db/client";

/** Runs `fn` in a transaction (a savepoint when `db` already is a transaction). */
export function inTransaction<T>(db: DbOrTx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
