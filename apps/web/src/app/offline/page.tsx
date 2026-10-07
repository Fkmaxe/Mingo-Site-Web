import type { Metadata } from "next";

export const metadata: Metadata = { title: "Hors ligne" };

/** Shown by the service worker when a page is not available offline. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 text-center">
      <p className="font-bold text-2xl text-primary">BDE Mingo</p>
      <h1 className="font-semibold text-xl">Pas de connexion</h1>
      <p className="text-muted-foreground text-sm">
        Cette page n'est pas disponible hors ligne. Tes billets déjà ouverts et l'écran de pointage
        restent accessibles.
      </p>
    </main>
  );
}
