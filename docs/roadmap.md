# Roadmap

Ne pas implémenter un lot avant que le précédent soit fini et testé. Cocher au fur et à mesure.

## Lot 0 — Socle

- [ ] Monorepo pnpm + Turborepo, Biome, TypeScript strict
- [ ] Docker Compose (Postgres) + `.env` validé par Zod dans chaque app
- [ ] API Hono : app, handler d'erreurs, OpenAPI, healthcheck `/health`
- [ ] Drizzle : client, premier schéma (`user`, `school_year`, `pole`, `membership`, `role_permission`, `audit_log`), seed
- [ ] Better Auth + Microsoft Entra ID, refus des domaines ≠ `@myskolae.fr`, route `/v1/me`
- [ ] RBAC : constantes de permissions, `requirePermission`, `assertPoleAccess`
- [ ] Web Next : layout mobile (nav en bas), login, page profil, client API typé
- [ ] CI GitHub Actions : lint, typecheck, tests (avec service Postgres)

## Lot 1 — MVP (boucle complète d'un événement)

- [ ] Événements : CRUD, visibilité, liste + détail mobile
- [ ] Inscriptions participants : inscription / désinscription, QR code, page « Mes billets »
- [ ] Check-in : scanner QR (BarcodeDetector + repli), recherche manuelle, idempotence
- [ ] Points open : mouvement auto au check-in, validation par le bureau, ajustement manuel, solde étudiant
- [ ] Export Google Sheets manuel (inscrits, présences, points open) + CSV

## Lot 2 — V1

- [ ] Liste d'attente + promotion automatique + mail
- [ ] Champs d'inscription personnalisés
- [ ] Créneaux staff et affectations
- [ ] Notation des membres (périodes, calcul présence, proposition, validation, publication)
- [ ] Mails transactionnels et rappels J-1

## Lot 3 — V2

- [ ] Tâches par pôle (kanban)
- [ ] Réunions + présences
- [ ] Recrutement
- [ ] Partenaires
- [ ] Synchro Sheets nocturne
- [ ] PWA installable + file de check-in hors ligne

## Plus tard

- Trésorerie, inscriptions d'équipe (tournois), billetterie payante, statistiques, notifications push.
