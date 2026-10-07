# apps/api — API Hono

Lire d'abord `../../docs/architecture.md` et `../../docs/api-conventions.md`.

## Commandes

```bash
pnpm dev            # tsx watch src/index.ts, port 3001
pnpm test           # vitest, base de test sur DATABASE_URL_TEST
pnpm db:generate    # drizzle-kit generate après une modif dans src/db/schema
pnpm db:migrate     # applique les migrations
pnpm db:seed
pnpm db:studio      # explorer la base
```

## Couches (respecter strictement)

| Fichier | A le droit de | N'a pas le droit de |
| --- | --- | --- |
| `*.routes.ts` | valider (via le schéma de route), lire `c.get("ctx")`, appeler un service, répondre | importer Drizzle, contenir un `if` métier |
| `*.service.ts` | logique métier, transactions, `assertPoleAccess`, émettre des événements, écrire l'audit | importer Hono, lire `process.env` |
| `*.repo.ts` | requêtes Drizzle sur les tables de son module | appeler un autre repo, lever des erreurs métier |
| `lib/*` | parler aux services externes (SMTP, Google, QR) derrière une interface | contenir de la logique métier |

Les services reçoivent toujours un contexte :

```ts
type Ctx = { user: SessionUser | null; permissions: Set<Permission>; db: Db | Tx };
```

Pour une transaction, le service crée la `tx` et la passe aux repos via `{ ...ctx, db: tx }`.

## Erreurs

- Lever `new AppError("EVENT_FULL", 409, "message en français")`. Jamais `throw new Error` dans un service.
- Les erreurs inattendues remontent au handler global qui log et renvoie 500.

## Base de données

- Schéma dans `src/db/schema/<domaine>.ts`, réexporté par `src/db/schema/index.ts`.
- Après modif : `pnpm db:generate`, relire le SQL généré, commiter la migration avec le schéma.
- Jamais de requête SQL brute concaténée. `sql\`\`` de Drizzle avec paramètres si besoin.
- Les requêtes de liste filtrent toujours par visibilité et par `deleted_at is null`.

## Tests

- Vitest + vraie base Postgres (pas de mock de Drizzle). Chaque fichier de test tourne dans une transaction annulée à la fin, ou sur une base remise à zéro.
- Helpers dans `src/test/` : `createTestUser({ role, pole })`, `authedRequest(user)`, `factories` pour event, registration…
- Par route : cas nominal, 401, 403, validation 400, et chaque `409`/`422` métier.
- Les services externes (`lib/mailer`, `lib/google-sheets`) sont remplacés par des faux en mémoire injectés, jamais appelés réellement en test.

## Variables d'environnement

Déclarées et validées dans `src/env.ts`. Ajouter une variable = l'ajouter dans `env.ts` **et** dans `.env.example` à la racine.
