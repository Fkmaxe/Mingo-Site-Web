# BDE Mingo — Plateforme de gestion

Site de gestion du BDE Mingo (ESGI Paris) : événements, inscriptions, check-in, points open, notation des membres, gestion interne, exports Google Sheets.

Lis ces fichiers avant toute tâche non triviale :

- `docs/context.md` — le métier : BDE, pôles, points open, notation. **Source de vérité fonctionnelle.**
- `docs/architecture.md` — structure du monorepo, flux, choix techniques.
- `docs/data-model.md` — entités et règles d'intégrité.
- `docs/api-conventions.md` — format des routes, erreurs, pagination, permissions.
- `docs/roadmap.md` — ce qui est dans le MVP et ce qui ne l'est pas.

Chaque app a son propre `CLAUDE.md` (`apps/api`, `apps/web`, `packages/shared`) avec ses règles locales.

## Stack

| Couche | Choix |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| API | Hono sur Node 22, TypeScript strict, `@hono/zod-openapi` |
| Base | PostgreSQL 16 + Drizzle ORM (migrations SQL versionnées) |
| Auth | Better Auth, email + mot de passe, adresse `@myskolae.fr` vérifiée par mail uniquement |
| Web | Next.js 15 (App Router), Tailwind CSS v4, shadcn/ui |
| Validation partagée | Zod, dans `packages/shared` |
| Tests | Vitest (unitaires + intégration API sur une vraie base Postgres) |
| Lint / format | Biome |
| Mails | nodemailer (SMTP du BDE en prod, Mailpit en dev) |
| Infra | Docker Compose (postgres, mailpit, api, web) |

## Commandes

```bash
pnpm install
docker compose up -d db mailpit  # Postgres :5432 + Mailpit (mails de dev) :8025
pnpm db:migrate                  # applique les migrations
pnpm db:seed                     # données de démo (pôles, événements, comptes fictifs)
pnpm dev                         # api :3001 + web :3000
pnpm test                        # tous les tests
pnpm --filter api test           # tests d'une seule app
pnpm lint && pnpm typecheck      # à lancer avant de déclarer une tâche finie
pnpm db:generate                 # génère une migration après modif du schéma Drizzle
```

## Règles non négociables

1. **TypeScript strict partout.** Pas de `any`, pas de `@ts-ignore`. `unknown` + validation Zod aux frontières.
2. **Toute entrée externe est validée par Zod** (body, query, params, env, réponses d'API tierces).
3. **Les permissions se vérifient côté API**, jamais uniquement côté web. Chaque route déclare sa permission (voir `docs/api-conventions.md`).
4. **Le web ne parle jamais à la base.** Il passe toujours par l'API.
5. **Les points open sont un journal (ledger)** : on n'UPDATE jamais un solde, on INSERT un mouvement. Idem pour toute donnée qui doit rester traçable.
6. **Toute action sensible écrit dans `audit_log`** (notes, points, rôles, exports, suppressions).
7. **Une modif de schéma = une migration générée et commitée**, jamais de `db:push` hors local.
8. **Pas de nouvelle dépendance sans le justifier** dans le message de commit ou la PR.
9. **Mobile d'abord** : tout écran se conçoit en 375 px puis s'élargit.
10. **Pas de secret dans le code.** Tout passe par `.env` (modèle dans `.env.example`), validé au démarrage.

## Façon de travailler

- Avant de coder une fonctionnalité : relis la section correspondante de `docs/context.md`, propose un plan court (fichiers touchés, routes, migrations), puis implémente.
- Un module métier = un dossier dans `apps/api/src/modules/<nom>` et `apps/web/src/features/<nom>`. Utilise `/new-module` pour le squelette.
- Écris les tests en même temps que le code : au minimum un test d'intégration par route et un test unitaire par règle métier (calcul de points, de note, liste d'attente).
- Termine chaque tâche par `pnpm lint && pnpm typecheck && pnpm test`. Si ça échoue, corrige avant de rendre la main.
- Si une règle métier est ambiguë, **demande** au lieu d'inventer, et note la question dans `docs/context.md` > « Questions ouvertes ».
- Code, noms de variables, commits : en anglais. Docs, textes UI et messages d'erreur affichés : en français.

## Commits

Conventional Commits : `feat(events): add waitlist promotion`, `fix(auth): reject non-myskolae domains`. Un commit = un changement cohérent.
