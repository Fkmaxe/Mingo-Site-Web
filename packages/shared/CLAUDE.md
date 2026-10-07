# packages/shared — `@bde/shared`

Code partagé entre l'API et le web. **Aucune dépendance runtime autre que Zod.** Pas d'accès réseau, pas de Node-only.

Contenu :

- `src/permissions.ts` — liste des permissions (`as const`), type `Permission`, mapping par défaut rôle → permissions.
- `src/enums.ts` — statuts et énumérations (`EventVisibility`, `RegistrationStatus`, `LedgerStatus`, `GradeStatus`…). Source unique : le schéma Drizzle les importe.
- `src/schemas/<domaine>.ts` — schémas Zod des entrées (`CreateEventInput`) et des sorties (`EventDto`), utilisés par les routes OpenAPI et par les formulaires du web.
- `src/errors.ts` — union des `ErrorCode` connus.
- `src/index.ts` — réexporte tout.

Règles :
- Un schéma d'entrée et son DTO de sortie vivent dans le même fichier.
- Messages de validation en français (`z.string().min(1, "Le titre est obligatoire")`).
- Modifier un schéma ici impacte API et web : lancer `pnpm typecheck` à la racine.
