import type { DbOrTx } from "../../db/client";
import { ping } from "./health.repo";

export async function isDatabaseUp(db: DbOrTx): Promise<boolean> {
  try {
    await ping(db);
    return true;
  } catch {
    return false;
  }
}
