# Modèle de données

Conventions SQL :
- Tables et colonnes en `snake_case`, tables au singulier (`event`, `registration`).
- Clé primaire `id uuid default gen_random_uuid()` (UUID v7 généré côté app si besoin d'ordre).
- `created_at timestamptz not null default now()`, `updated_at timestamptz` mis à jour par le repo.
- Suppression logique (`deleted_at`) uniquement là où l'historique compte (event, membership, partner).
- Enums Postgres pour les statuts, déclarés dans `packages/shared` puis dans le schéma Drizzle.
- Toute FK a un index. Toute contrainte métier exprimable en SQL l'est (unique, check).

## Entités

### Identité et organisation

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `user` | email (unique, `@myskolae.fr`), name, promo, image, is_admin (admin technique) | check sur le domaine de l'email |
| `session`, `account`, `verification` | gérées par Better Auth | ne pas modifier à la main |
| `school_year` | label (`2026-2027`), starts_on, ends_on, is_current | un seul `is_current = true` |
| `pole` | slug, name, description | slug unique |
| `membership` | user_id, pole_id (nullable pour le bureau), school_year_id, role (`member`, `pole_lead`, `board`), board_position (`president`, `vice_president`, `secretary`, `treasurer`, null), is_active | unique (user_id, pole_id, school_year_id) |
| `role_permission` | role, permission | unique (role, permission) |

Un utilisateur sans `membership` actif sur l'année courante est un **étudiant**.

### Événements

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `event` | pole_id, title, slug, description, poster_url, location, starts_at, ends_at, visibility, capacity (nullable = illimité ; en équipes pour un événement par équipe), registration_deadline, open_points_value, custom_fields_schema (jsonb), team_min_size, team_max_size (Lot 4, les deux null = inscription individuelle), status (`draft`, `published`, `cancelled`, `done`) | ends_at > starts_at ; tailles d'équipe toutes deux nulles ou 1 ≤ min ≤ max |
| `registration` | event_id, user_id, status (`confirmed`, `waitlisted`, `cancelled`), waitlist_position, answers (jsonb, Lot 2), qr_token (unique), team_id (Lot 4, vidé à l'annulation), cancelled_at | unique (event_id, user_id) ; cancelled_at ssi cancelled ; waitlist_position ssi waitlisted |
| `team` | event_id, name, join_code (6 caractères, unique), captain_user_id, status (`confirmed`, `waitlisted`), waitlist_position | unique (event_id, lower(name)) ; les membres sont les inscriptions qui pointent vers l'équipe et partagent son statut et sa position ; waitlist_position ssi waitlisted |
| `staff_slot` | event_id, label, starts_at, ends_at, capacity | |
| `staff_assignment` | staff_slot_id, membership_id, status (`proposed`, `validated`, `declined`) | unique (staff_slot_id, membership_id) |
| `attendance` | event_id, user_id, kind (`participant`, `staff`, `meeting`), checked_in_at, checked_in_by | unique (event_id, user_id, kind) |

### Points open et notes

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `open_points_ledger` | user_id, school_year_id, delta (int non nul, peut être négatif), reason, source (`auto`, `manual`), attendance_id (nullable), status (`pending`, `validated`, `rejected`, `exported`), decided_by, decided_at (validation **ou** refus), created_by | `reason` non vide si source = manual ; unique (attendance_id) ; decided_at renseigné ssi status ≠ pending |
| `grade_period` | school_year_id, label, starts_on, ends_on, scale_max (20), points_per_presence | ends_on > starts_on |
| `member_grade` | membership_id, grade_period_id, presence_points, involvement_points, final_score, comment, status (`draft`, `submitted`, `validated`, `published`), proposed_by, validated_by | unique (membership_id, grade_period_id) ; final = min(scale_max, presence + involvement) |

Solde points open d'un étudiant = `sum(delta) where status in ('validated','exported')`.
`presence_points` est **calculé** (somme des points des présences pointées sur la période), jamais saisi. Un événement peut surcharger les points par présence (`event.member_points`).

### Inventaire

| Table | Colonnes clés | Contraintes |
| --- | --- | --- |
| `inventory_location` | name | nom unique (insensible à la casse) |
| `inventory_category` | name | nom unique (insensible à la casse) |
| `inventory_item` | number (code INV-xxxx), name, description, category_id, kind (`unique`, `stock`), quantity, condition, location_id, pole_id, photo, archived_at | quantity ≥ 0 ; un objet unique a une quantité de 1 |
| `inventory_checkout` | item_id, quantity, holder, event_id, due_at, out_at/by, returned_at/by, return_condition | quantité > 0 ; return_condition ssi returned_at |
| `inventory_movement` | item_id, action, actor_user_id, details (jsonb), note | **ajout seul** ; date `clock_timestamp()` pour garder l'ordre dans une transaction |

### Gestion interne

| Table | Colonnes clés |
| --- | --- |
| `task` | pole_id, title, description, status (`todo`, `doing`, `done`), assignee_membership_id, due_on, deleted_at |
| `meeting` | pole_id (nullable = réunion générale), title, starts_at, location, agenda, minutes, deleted_at |
| `meeting_attendance` | meeting_id, user_id, marked_by — une ligne par présent, comptée dans la note |
| `application` | user_id, school_year_id, wished_pole_id, motivation, status (`new`, `interview`, `accepted`, `rejected`) |
| `partner` | name, website, contact_name, contact_email, status (`prospect`, `contacted`, `negotiating`, `active`, `ended`), benefits, notes, owner_membership_id |
| `treasury_transaction` | event_id (nullable), school_year_id, label, amount_cents (int signé, non nul, jamais modifié), occurred_on, receipt_url, reversal_of_id (unique : écriture d'annulation), created_by |
| `event_budget` | event_id (unique), budget_cents (≥ 0), updated_by |
| `export_target` | kind (`registrations`, `attendance`, `open_points`, `grades`, `members`, `budget`), spreadsheet_id, sheet_name, auto_sync, last_synced_at |
| `audit_log` | actor_user_id, action, entity, entity_id, payload (jsonb), created_at |

Montants toujours en **centimes entiers**, jamais en float.

## Règles d'intégrité à tester

1. Impossible de s'inscrire après `registration_deadline` ou à un événement `draft`/`cancelled`.
2. Si `confirmed` atteint `capacity`, les nouvelles inscriptions passent `waitlisted` avec la position suivante.
3. Une annulation libère une place → le premier `waitlisted` passe `confirmed`, dans la même transaction.
4. Un check-in participant d'un non-membre crée exactement un mouvement `pending` (unique sur attendance_id).
5. Un membre actif de l'année ne reçoit jamais de points open automatiques.
6. Un ajustement manuel sans motif est refusé.
7. Une note `published` n'est plus modifiable sauf par le bureau, avec entrée dans `audit_log`.
8. Un email hors `@myskolae.fr` ne peut pas créer de compte.
9. À un événement par équipe, on ne s'inscrit qu'en créant ou en rejoignant une équipe, jamais au-delà de `team_max_size` membres actifs. La capacité compte alors des équipes ; une équipe vide est supprimée et sa place passe à la première équipe en attente, avec tous ses membres. Le capitaine qui part est remplacé par le plus ancien membre.
