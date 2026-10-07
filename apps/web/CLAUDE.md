# apps/web — Next.js + Tailwind

Le web est une **interface**, pas un backend : aucune logique métier, aucun accès base. Toute donnée vient de l'API.

## Commandes

```bash
pnpm dev            # next dev, port 3000
pnpm build
pnpm test           # vitest + testing-library pour les composants avec logique
pnpm api:types      # régénère les types du client depuis http://localhost:3001/v1/openapi.json
```

## Structure

- `src/app/(public)` : accueil, événements publics, partenaires. Rendu serveur, mis en cache.
- `src/app/(app)` : espace connecté (mes billets, mes points, ma note, staff).
- `src/app/(admin)` : bureau et responsables (gestion événements, check-in, validation, exports).
- `src/features/<module>/` : composants, hooks et appels API d'un domaine. Miroir des modules de l'API.
- `src/components/ui/` : composants shadcn/ui (générés, peu modifiés).
- `src/lib/api.ts` : client typé (`openapi-fetch`) — **seule** façon d'appeler l'API.

## Règles

1. **Server Components par défaut.** `"use client"` seulement pour l'interactivité (formulaires, scanner, menus).
2. **Lecture** : fetch côté serveur dans la page avec le client typé, en transmettant le cookie de session.
3. **Écriture** : Server Actions qui appellent l'API, puis `revalidatePath`/`revalidateTag`. Les formulaires utilisent `react-hook-form` + le schéma Zod de `@bde/shared`.
4. **Erreurs API** : afficher `error.message` (déjà en français) ; brancher sur `error.code` pour les cas spéciaux (ex. `EVENT_FULL` → afficher « liste d'attente »).
5. **Permissions** : l'UI masque ce que l'utilisateur ne peut pas faire (via `/v1/me`), mais ne s'y fie jamais pour la sécurité.
6. Pas de `useEffect` pour charger des données.

## Design

- **Mobile d'abord** : concevoir en 375 px. Navigation principale en barre en bas sur mobile, latérale sur desktop.
- Zones tactiles d'au moins 44 px. Action principale en bas de l'écran, à portée de pouce.
- Tailwind uniquement, pas de CSS custom sauf variables de thème dans `globals.css`. Classes ordonnées par Biome.
- Couleurs via les tokens du thème (`bg-primary`, `text-muted-foreground`), jamais de hex en dur dans les composants.
- Mode sombre supporté dès le départ.
- Accessibilité : labels sur tous les champs, focus visible, contraste AA, `alt` sur les images.
- Images via `next/image`, polices via `next/font`.

## Performance

- Objectif Lighthouse mobile ≥ 90. Pages publiques statiques ou ISR.
- Le scanner QR et les bibliothèques lourdes sont chargés en `dynamic(() => import(...), { ssr: false })`.
- Pas de bibliothèque de composants en plus de shadcn/ui.
