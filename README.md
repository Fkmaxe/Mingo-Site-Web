# BDE Mingo

Plateforme de gestion du BDE Mingo (ESGI Paris) : événements, inscriptions, check-in QR, points open, notation des membres, gestion interne, exports Google Sheets.

Stack : **Hono** (API) · **Next.js + Tailwind** (web) · **PostgreSQL + Drizzle** · monorepo **pnpm + Turborepo**. Détails dans [`CLAUDE.md`](./CLAUDE.md) et [`docs/`](./docs).

## Démarrer (développement)

```bash
cp .env.example .env
pnpm install
docker compose up -d db mailpit   # Postgres + Mailpit (mails de dev sur http://localhost:8025)
pnpm db:migrate && pnpm db:seed
pnpm dev     # web http://localhost:3000 · api http://localhost:3001 · doc API http://localhost:3001/v1/docs
```

## Tout lancer dans Docker

```bash
cp .env.example .env                        # puis adapter SMTP_* si besoin
docker compose --profile full up -d --build # db + mailpit + api + web
```

- Web : http://localhost:3000 · API : http://localhost:3001 (doc `/v1/docs` désactivée en production).
- Les migrations sont appliquées au démarrage du conteneur API.
- Données de démo (une seule fois, depuis ta machine) : `pnpm db:seed`.
- Dans Docker, Mailpit s'appelle `mailpit` : pour l'utiliser, `SMTP_HOST=mailpit` et `SMTP_PORT=1025`. **Attention** : avec le SMTP réel dans `.env`, les tests manuels envoient de vrais mails aux comptes de démo.
- `docker compose --profile full down` pour tout arrêter (le volume de la base est conservé).

## Mise en production

Tout est dans **`docker-compose.prod.yml`** (un seul fichier). Sur le serveur :

```bash
git clone <dépôt> && cd <dossier>
cp .env.example .env && chmod 600 .env   # puis remplir (voir ci-dessous)
docker compose up -d --build             # COMPOSE_FILE=docker-compose.prod.yml est dans .env
docker compose ps                        # db, api, web : healthy
```

Le `.env` du serveur, en plus des variables de l'exemple :

| Variable | Valeur |
| --- | --- |
| `COMPOSE_FILE` | `docker-compose.prod.yml` |
| `WEB_BIND` | IP de cette machine si le reverse proxy est **ailleurs** (ex. `192.168.1.208`) ; `127.0.0.1` s'il est sur la même machine |
| `WEB_ORIGIN`, `BETTER_AUTH_URL` | `https://<domaine>`, sans port |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | mot de passe fort, avant le premier lancement |
| `SMTP_*`, `MAIL_FROM` | SMTP du BDE |
| `VAPID_*` | `pnpm --filter api push:keys`, une seule fois (en changer désabonne tous les appareils) |

L'API refuse de démarrer si une valeur est invalide ou restée à celle de l'exemple : `docker compose logs api` dit laquelle.

Tester l'envoi des mails : `docker compose exec api node dist/mail-test.js toi@exemple.fr` (affiche la config utilisée et explique l'erreur).

**Reverse proxy** (Nginx Proxy Manager, Nginx…) : envoyer `https://<domaine>` vers `http://<WEB_BIND>:3000`, websockets activés. Rien d'autre à régler. Sans reverse proxy : `COMPOSE_PROFILES=caddy` et `DOMAIN=<domaine>` dans `.env`, le Caddy du projet fait le HTTPS sur 80/443.

- Migrations appliquées au démarrage de l'API. Ne **jamais** lancer `pnpm db:seed` en production.
- Mise à jour : `git pull && docker compose up -d --build`. Arrêt : `docker compose down` (les données restent ; **jamais** `-v`, qui efface la base).
- **Sauvegardes** : `backups/bde-AAAA-MM-JJ.dump` chaque jour (14 jours gardés), à recopier hors du serveur. Restauration :
  ```bash
  docker compose exec -T db pg_restore -U bde -d bde_mingo --clean --if-exists < backups/bde-AAAA-MM-JJ.dump
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

- En dev, les mails (vérification d'adresse, mot de passe oublié) arrivent dans **Mailpit** : http://localhost:8025. Comptes de démo créés par `pnpm db:seed` : `etudiant@`, `membre.sport@`, `resp.sport@`, `president@`, `tresorier@`, `admin@myskolae.fr`, mot de passe `mingo-demo-2026`.
- En prod, renseigner le SMTP du BDE (`SMTP_*`, `MAIL_FROM`) dans `.env`.
- Créer un **compte de service Google** au nom du BDE pour les exports Sheets.
