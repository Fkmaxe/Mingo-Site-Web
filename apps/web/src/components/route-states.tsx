"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shown while a page loads its data: the shape of a page, so the tap is visibly taken. */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="h-11 rounded-lg bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

/** A page failed (the API is down, a bug…): say it plainly, offer to retry. */
export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-5" role="alert">
      <h1 className="font-bold font-display text-xl">Oups, la page n'a pas pu s'afficher</h1>
      <p className="text-muted-foreground text-sm">
        Le serveur ne répond pas ou une erreur est survenue. Réessaie dans un instant ; si ça
        continue, préviens le bureau
        {error.digest ? (
          <>
            {" "}
            (code <code className="rounded bg-muted px-1">{error.digest}</code>)
          </>
        ) : null}
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
}
