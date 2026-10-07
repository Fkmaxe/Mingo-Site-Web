import { loadEnv } from "../../env";
import { createDb } from "../client";
import { SEED_PASSWORD, seed } from "../seed";

const env = loadEnv();
if (env.NODE_ENV === "production") {
  throw new Error("Le seed de démo ne doit pas tourner en production.");
}
const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
await seed(db);
await close();
console.log(`Données de démo insérées (mot de passe des comptes : ${SEED_PASSWORD}).`);
