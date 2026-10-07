# Conventions de l'API

## Routes

- Préfixe `/v1`. Ressources au pluriel, en kebab-case : `/v1/events`, `/v1/open-points`.
- Sous-ressources quand la relation est forte : `/v1/events/:eventId/registrations`.
- Actions métier qui ne sont pas du CRUD : `POST` sur un verbe explicite.
  - `POST /v1/registrations/:id/cancel`
  - `POST /v1/events/:eventId/checkin` (body : `{ qrToken }` ou `{ userId }`)
  - `POST /v1/open-points/validate` (body : `{ ids: [...] }`)
  - `POST /v1/grades/:id/publish`
- `GET /v1/me` renvoie l'utilisateur courant, ses rôles et permissions (utilisé par le web pour adapter l'UI).
- Doc OpenAPI exposée sur `/v1/openapi.json`, UI Scalar sur `/v1/docs` (désactivée en prod).

## Définir une route

Toujours avec `createRoute` de `@hono/zod-openapi` :

```ts
export const listEvents = createRoute({
  method: "get",
  path: "/events",
  tags: ["events"],
  request: { query: ListEventsQuery },
  responses: {
    200: { content: { "application/json": { schema: paginated(EventDto) } }, description: "Liste des événements" },
  },
  middleware: [requirePermission("events:read")] as const,
});
```

Le handler ne fait que : récupérer les entrées validées → appeler le service → `c.json(...)`.

## Permissions

- Format `ressource:action` : `events:create`, `events:update`, `checkin:scan`, `open-points:validate`, `grades:propose`, `grades:validate`, `exports:run`, `members:manage`, `budget:manage`.
- La liste complète vit dans `packages/shared/src/permissions.ts` (constante `as const` + type dérivé).
- Le mapping rôle → permissions est en base (`role_permission`), seedé depuis une constante par défaut.
- Les permissions **limitées à un pôle** (un responsable ne gère que son pôle) sont vérifiées dans le service avec `assertPoleAccess(ctx, poleId)`, pas seulement dans le middleware.

## Réponses

- Succès : l'objet ou la liste directement, pas d'enveloppe `{ data }` pour un objet seul.
- Listes paginées :
  ```json
  { "items": [...], "nextCursor": "opaque-string-or-null" }
  ```
  Pagination par curseur (`?cursor=&limit=`), `limit` max 100, défaut 20.
- Dates en ISO 8601 UTC. Montants en centimes (`amountCents`). Champs JSON en camelCase.
- Les DTO de réponse sont définis dans `packages/shared` et ne fuient jamais de colonnes internes (`qr_token` d'un autre utilisateur, emails pour un visiteur, etc.).

## Erreurs

Format unique, produit par le handler global à partir de `AppError` :

```json
{ "error": { "code": "EVENT_FULL", "message": "L'événement est complet, tu as été placé en liste d'attente.", "details": {} } }
```

| HTTP | Quand | Exemples de `code` |
| --- | --- | --- |
| 400 | Validation Zod | `VALIDATION_ERROR` (détails = issues Zod) |
| 401 | Pas de session | `UNAUTHENTICATED` |
| 403 | Permission manquante, mauvais pôle, mauvais domaine | `FORBIDDEN`, `DOMAIN_NOT_ALLOWED` |
| 404 | Ressource absente ou invisible pour l'utilisateur | `NOT_FOUND` |
| 409 | Conflit métier | `ALREADY_REGISTERED`, `DEADLINE_PASSED`, `ALREADY_CHECKED_IN` |
| 422 | Règle métier non respectée | `MANUAL_ADJUSTMENT_REQUIRES_REASON` |
| 500 | Le reste (loggé, message générique) | `INTERNAL_ERROR` |

- `code` en SCREAMING_SNAKE_CASE, stable (le web s'en sert). `message` en français, affichable tel quel.
- Ne jamais renvoyer de stack trace ou de message SQL au client.

## Transactions et idempotence

- Toute opération qui écrit dans plusieurs tables passe par `db.transaction`.
- Le check-in est idempotent : un second scan renvoie `409 ALREADY_CHECKED_IN` avec l'heure du premier, sans rien créer.
- Les routes appelées par le scan hors ligne acceptent un en-tête `Idempotency-Key`.

## Sécurité

- CORS limité à l'origine du web.
- Rate limiting sur `/api/auth/*` et sur le check-in.
- `qrToken` : 32 octets aléatoires en base64url, jamais dérivé d'un id.
