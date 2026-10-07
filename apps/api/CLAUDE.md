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
pnpm openapi:export # écrit openapi.json (commité) ; le web en génère ses types
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

## Permissions

- Liste dans `packages/shared/src/permissions.ts`, mapping par défaut `DEFAULT_ROLE_PERMISSIONS` (inséré au premier `db:migrate` uniquement, table vide).
- Rôles cumulatifs calculés à chaque requête (`core/permissions/roles.ts`) : `student` toujours, `member`/`pole_lead`/`board` selon les memberships actifs de l'année courante, `treasurer` via `board_position`, `admin` via `user.is_admin`.
- Route : `middleware: [requirePermission("events:create")] as const`. Action limitée à un pôle : `assertPoleAccess(ctx, poleId)` dans le service (`poles:all` ou responsable du pôle).
- **Ajouter une permission** = l'ajouter à la constante **et** écrire une migration SQL (`pnpm drizzle-kit generate --custom`) qui l'insère dans `role_permission` pour les rôles concernés, **seulement si la table n'est pas vide** (`WHERE EXISTS (SELECT 1 FROM role_permission)`) : sur une installation neuve, le mapping par défaut complet est inséré après les migrations, à condition que la table soit vide. Exemple : `drizzle/0011_meetings_permission.sql`.

## Tests

- Vitest + vraie base Postgres (pas de mock de Drizzle). La base de test est reconstruite depuis les migrations au lancement, puis vidée avant chaque test (`src/test/setup.ts`).
- Helpers dans `src/test/` : `createPersona("pole_lead", { poleId })` et autres `factories` (user, pôle, année, événement), `call(method, path, userId, body)` pour une requête authentifiée, `readJson`/`readError` pour lire une réponse avec un schéma Zod.
- Par route : cas nominal, 401, 403, validation 400, et chaque `409`/`422` métier.
- Les services externes (`lib/mailer`, `lib/google-sheets`) sont remplacés par des faux en mémoire injectés, jamais appelés réellement en test.

## Variables d'environnement

Déclarées et validées dans `src/env.ts`. Ajouter une variable = l'ajouter dans `env.ts` **et** dans `.env.example` à la racine.
