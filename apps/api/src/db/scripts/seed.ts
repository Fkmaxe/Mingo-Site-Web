import { loadEnv } from "../../env";
import { createDb } from "../client";
import { seed } from "../seed";

const { db, close } = createDb(loadEnv().DATABASE_URL, { max: 1 });
await seed(db);
await close();
console.log("Données de démo insérées.");
