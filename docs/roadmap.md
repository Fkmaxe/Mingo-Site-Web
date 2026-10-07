# Roadmap

Ne pas implémenter un lot avant que le précédent soit fini et testé. Cocher au fur et à mesure.

## Lot 0 — Socle

- [x] Monorepo pnpm + Turborepo, Biome, TypeScript strict
- [x] Docker Compose (Postgres) + `.env` validé par Zod dans chaque app
- [x] API Hono : app, handler d'erreurs, OpenAPI, healthcheck `/health`
- [x] Drizzle : client, premier schéma (`user`, `school_year`, `pole`, `membership`, `role_permission`, `audit_log`), seed
- [x] Better Auth email + mot de passe (adresse vérifiée par mail), refus des domaines ≠ `@myskolae.fr`, route `/v1/me`
- [x] RBAC : constantes de permissions, `requirePermission`, `assertPoleAccess`
- [x] Web Next : layout mobile (nav en bas), login, page profil, client API typé
- [x] CI GitHub Actions : lint, typecheck, tests (avec service Postgres)

## Lot 1 — MVP (boucle complète d'un événement)

- [x] Événements : CRUD, visibilité, liste + détail mobile
- [x] Inscriptions participants : inscription / désinscription, QR code, page « Mes billets »
- [x] Check-in : scanner QR (BarcodeDetector + repli), recherche manuelle, idempotence
- [x] Points open : mouvement auto au check-in, validation par le bureau, ajustement manuel, solde étudiant
- [x] Export CSV (inscrits, présences, points open). Google Sheets abandonné pour l'instant : le CSV suffit (décision d'octobre 2026)

## Lot 2 — V1

- [x] Liste d'attente + promotion automatique + mail
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
