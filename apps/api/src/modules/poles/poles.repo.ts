import { asc, eq } from "drizzle-orm";
import type { DbOrTx } from "../../db/client";
import { pole } from "../../db/schema";

const columns = { id: pole.id, slug: pole.slug, name: pole.name, description: pole.description };

export function findAllPoles(db: DbOrTx) {
  return db.select(columns).from(pole).orderBy(asc(pole.name));
}

export async function findPoleById(db: DbOrTx, poleId: string) {
  const [row] = await db.select(columns).from(pole).where(eq(pole.id, poleId));
  return row;
}
