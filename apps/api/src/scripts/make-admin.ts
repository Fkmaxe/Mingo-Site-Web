// Grants (or revokes) the site administrator right, by email. For the first administrator,
// or to recover access. The account must exist (created on the site, address confirmed).
//   Docker : docker compose exec api node dist/make-admin.js prenom.nom@myskolae.fr [--revoke]
//   dev    : pnpm --filter api make-admin prenom.nom@myskolae.fr [--revoke]
import { z } from "zod";
import { createDb } from "../db/client";
import { loadEnv } from "../env";
import { setAdminByEmail } from "../modules/admin";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || !z.email().safeParse(email).success || (flag && flag !== "--revoke")) {
    console.error("Usage : make-admin <adresse du compte> [--revoke]");
    process.exit(2);
  }
  const revoke = flag === "--revoke";
  const { db, close } = createDb(loadEnv().DATABASE_URL, { max: 1 });
  try {
    const done = await setAdminByEmail(db, email, !revoke);
    if (!done) {
      console.error(`✘ Aucun compte pour ${email}. Crée-le d'abord sur le site, puis relance.`);
      process.exitCode = 1;
      return;
    }
    console.log(
      revoke
        ? `✔ ${done.name} (${done.email}) n'est plus administrateur.`
        : `✔ ${done.name} (${done.email}) est administrateur : toutes les permissions du site.`,
    );
    console.log(
      "  Action inscrite au journal d'audit. Reconnecte-toi pour voir l'espace Administration.",
    );
  } finally {
    await close();
  }
}

if (process.argv[1]?.match(/make-admin\.(ts|js)$/)) void main();
