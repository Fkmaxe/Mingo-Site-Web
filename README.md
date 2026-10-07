# BDE Mingo

Plateforme de gestion du BDE Mingo (ESGI Paris) : événements, inscriptions, check-in QR, points open, notation des membres, gestion interne, exports Google Sheets.

Stack : **Hono** (API) · **Next.js + Tailwind** (web) · **PostgreSQL + Drizzle** · monorepo **pnpm + Turborepo**. Détails dans [`CLAUDE.md`](./CLAUDE.md) et [`docs/`](./docs).

## Démarrer

```bash
cp .env.example .env
pnpm install
docker compose up -d db mailpit   # Postgres + Mailpit (mails de dev sur http://localhost:8025)
pnpm db:migrate && pnpm db:seed
pnpm dev     # web http://localhost:3000 · api http://localhost:3001 · doc API http://localhost:3001/v1/docs
```

## Ce dossier est prêt pour Claude Code

| Fichier | Rôle |
| --- | --- |
| `CLAUDE.md` | Contexte projet, stack, commandes, règles globales — chargé à chaque session |
| `apps/*/CLAUDE.md`, `packages/shared/CLAUDE.md` | Règles locales, chargées quand Claude travaille dans ce dossier |
| `docs/context.md` | Fonctionnement réel du BDE (source de vérité métier) |
| `docs/architecture.md`, `docs/data-model.md`, `docs/api-conventions.md` | Choix techniques et conventions |
| `docs/roadmap.md` | Lots à livrer dans l'ordre |
| `.claude/settings.json` | Permissions (commandes autorisées / interdites) + formatage auto après chaque édition |
| `.claude/commands/` | `/new-module`, `/new-endpoint`, `/migration`, `/review` |
| `.claude/agents/code-reviewer.md` | Agent de revue selon les règles du projet |

### Premier prompt conseillé

> Lis CLAUDE.md et tous les fichiers de docs/. Puis réalise le **Lot 0 — Socle** de docs/roadmap.md, étape par étape : propose-moi d'abord le plan (fichiers créés, dépendances installées), attends ma validation, puis implémente en lançant lint, typecheck et tests à la fin de chaque étape.

Ensuite, une fonctionnalité à la fois : `/new-module events`, `/new-module registrations`, etc.

## Avant de commencer

- Créer l'app dans **Microsoft Entra ID** (portail Azure de l'école ou demande à la DSI) et renseigner `MICROSOFT_*` dans `.env`. Redirect URI dev : `http://localhost:3001/api/auth/callback/microsoft`.
- Créer un **compte de service Google** au nom du BDE pour les exports Sheets.
