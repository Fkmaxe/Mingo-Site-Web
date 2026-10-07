# Architecture

## Vue d'ensemble

```
Navigateur (mobile / desktop)
        │
        ▼
apps/web  ── Next.js (App Router, Tailwind) ── rendu serveur, aucune logique métier
        │  fetch HTTP (client typé généré depuis l'OpenAPI)
        ▼
apps/api  ── Hono (Node) ── logique métier, permissions, auth
        │  Drizzle ORM
        ▼
PostgreSQL

apps/api ──► Google Sheets API (compte de service BDE)
apps/api ──► SMTP (mails : vérification d'adresse, mot de passe, billets, rappels, liste d'attente)
apps/api ──► jobs planifiés (synchro Sheets, rappels J-1)
```

## Pourquoi ces choix

- **API séparée (Hono)** plutôt que tout dans Next : la logique métier est testable sans le front, l'API peut servir une future app mobile ou un bot Discord, et la frontière de sécurité est nette.
- **Hono + zod-openapi** : routes typées, validation et doc OpenAPI générées depuis le même schéma Zod. Le web consomme un client typé, donc un changement d'API casse la compilation du front au lieu de casser en prod.
- **Drizzle** : schéma en TypeScript, SQL lisible, migrations versionnées, pas de magie.
- **Monolithe modulaire** : un seul déploiement d'API, mais chaque domaine est isolé dans son module.

## Arborescence

```
bde-mingo/
├── CLAUDE.md
├── docs/
├── docker-compose.yml
├── .env.example
├── package.json / pnpm-workspace.yaml / turbo.json / biome.json
├── apps/
│   ├── api/
│   │   ├── CLAUDE.md
│   │   ├── drizzle.config.ts
│   │   ├── drizzle/                  # migrations SQL générées (commitées)
│   │   └── src/
│   │       ├── index.ts              # démarrage du serveur
│   │       ├── app.ts                # création de l'app Hono, montage des modules
│   │       ├── env.ts                # variables d'env validées par Zod
│   │       ├── db/
│   │       │   ├── client.ts
│   │       │   ├── schema/           # un fichier par domaine, réexportés dans index.ts
│   │       │   └── seed.ts
│   │       ├── core/                 # le socle partagé
│   │       │   ├── auth/             # Better Auth + middleware session
│   │       │   ├── permissions/      # RBAC : définition + middleware requirePermission
│   │       │   ├── audit/            # écriture audit_log
│   │       │   ├── errors.ts         # AppError + handler global
│   │       │   ├── events.ts         # bus d'événements interne typé
│   │       │   └── http.ts           # helpers de réponse, pagination
│   │       ├── modules/
│   │       │   ├── events/
│   │       │   ├── registrations/
│   │       │   ├── staff/
│   │       │   ├── checkin/
│   │       │   ├── open-points/
│   │       │   ├── grades/
│   │       │   ├── members/
│   │       │   ├── poles/
│   │       │   ├── tasks/
│   │       │   ├── partners/
│   │       │   └── exports/
│   │       ├── jobs/                 # tâches planifiées
│   │       └── lib/                  # adaptateurs externes : mailer, google-sheets, qr
│   └── web/
│       ├── CLAUDE.md
│       └── src/
│           ├── app/                  # routes Next (App Router)
│           │   ├── (public)/
│           │   ├── (app)/            # espace connecté
│           │   └── (admin)/          # bureau / responsables
│           ├── features/<module>/    # composants + hooks par domaine
│           ├── components/ui/        # shadcn/ui
│           ├── components/           # composants partagés (layout, nav mobile…)
│           └── lib/                  # client API, auth, utils
└── packages/
    └── shared/                       # schémas Zod, types, constantes (permissions, statuts)
```

## Anatomie d'un module API

```
modules/registrations/
├── registrations.routes.ts    # définition OpenAPI + handlers fins (parse → service → réponse)
├── registrations.service.ts   # logique métier, transactions, émission d'événements
├── registrations.repo.ts      # requêtes Drizzle uniquement
├── registrations.schemas.ts   # schémas Zod spécifiques à l'API (sinon dans packages/shared)
├── registrations.test.ts      # tests d'intégration des routes
└── index.ts                   # export du router + abonnements aux événements
```

Règles :
- **routes** : pas de logique, pas de Drizzle. Valide, appelle le service, renvoie.
- **service** : la logique. Reçoit un `ctx` (user, permissions, db/tx). Pas d'objets Hono.
- **repo** : seul endroit qui importe Drizzle et les tables du module.
- Un module n'importe jamais le `repo` d'un autre module. Il passe par son `service` ou par un événement.

## Communication entre modules

Bus d'événements interne typé (`core/events.ts`), synchrone dans la même transaction quand c'est critique.

Exemple central :
```
checkin.recorded  ──►  open-points : crée un mouvement `pending` si participant non-membre
                  └──►  grades      : rien à faire, la présence est lue au calcul
registration.cancelled ──► registrations : promotion du premier en liste d'attente + mail
```

## Auth

- Better Auth monté sur `/api/auth/*` dans l'API, **email + mot de passe** (hash scrypt).
- Adresse vérifiée par mail obligatoire avant toute connexion ; réinitialisation du mot de passe par mail.
- Domaine `@myskolae.fr` vérifié trois fois : hook avant l'inscription (`403 DOMAIN_NOT_ALLOWED`), hook de création d'utilisateur, contrainte SQL `check` sur `user.email`.
- Rate limiting sur la connexion, l'inscription et la demande de réinitialisation.
- `BETTER_AUTH_URL` est l'URL **du web** : le web proxifie `/api/auth/*` vers l'API, donc cookies et liens des mails sont sur l'origine du web.
- Session en cookie httpOnly, partagé avec le web (même domaine parent en prod, proxy Next en dev).
- Le middleware `requireAuth` charge l'utilisateur et ses permissions dans le contexte Hono.

## Déploiement

- Docker Compose : `db`, `api`, `web` (+ `caddy` en prod pour TLS).
- Migrations appliquées au démarrage du conteneur API.
- Sauvegarde quotidienne de la base (`pg_dump` vers un stockage externe).
