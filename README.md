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

Sur le serveur (Docker + Compose v2.24 ou plus), avec le domaine pointé vers sa IP :

```bash
cp .env.example .env    # puis remplir, voir la checklist
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
```

- Seul **Caddy** est exposé (80/443, certificat HTTPS automatique). La base, l'API et le web restent dans le réseau Docker.
- Les migrations sont appliquées au démarrage de l'API. Ne **jamais** lancer `pnpm db:seed` en production.
- Checklist `.env` (l'API refuse de démarrer si une valeur de dev est restée) :
  - `DOMAIN=bde-mingo.fr`, `WEB_ORIGIN` et `BETTER_AUTH_URL` = `https://<domaine>` ;
  - `BETTER_AUTH_SECRET` généré avec `openssl rand -base64 32` ;
  - `POSTGRES_PASSWORD` fort (pas `bde`), et `DATABASE_URL` cohérent pour les commandes lancées hors Docker ;
  - `SMTP_*` et `MAIL_FROM` du BDE ;
  - notifications push : `pnpm --filter api push:keys` (une seule fois, à garder : changer les clés désabonne tous les appareils), puis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **Sauvegardes** : le service `backup` écrit chaque jour `backups/bde-AAAA-MM-JJ.dump` (14 jours gardés). Les recopier hors du serveur. Restauration :
  ```bash
  docker compose exec -T db pg_restore -U bde -d bde_mingo --clean --if-exists < backups/bde-AAAA-MM-JJ.dump
  ```
- **Serveur avec un reverse proxy déjà en place** (Nginx, Nginx Proxy Manager…) : ajouter `docker-compose.proxy.yml`. Le Caddy du projet n'est alors pas lancé, et le web écoute sur `127.0.0.1:3000` seulement. Le proxy doit envoyer vers `http://127.0.0.1:3000` (proxy sur une autre machine : `WEB_BIND=<IP de la VM>` dans `.env`, proxy vers `http://<IP de la VM>:3000`, et règle `DOCKER-USER` qui n'ouvre le port 3000 qu'à l'IP du proxy, ufw ne filtrant pas les ports Docker) et **remplacer** `X-Forwarded-For` par l'IP du visiteur (Nginx : `proxy_set_header X-Forwarded-For $remote_addr;`), sinon la limite de tentatives de connexion peut être contournée.
- Mise à jour : `git pull` puis la même commande `up -d --build`.

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
