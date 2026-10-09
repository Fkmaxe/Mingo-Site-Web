import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DisplayTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Année scolaire pas encore ouverte" };

/** Shown by pages that need a current school year while none is open. */
export default async function NoSchoolYearPage() {
  const me = await requireMe();
  const canOpen = me.permissions.includes("settings:manage");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarClock aria-hidden className="size-8" />
      </span>
      <DisplayTitle className="text-2xl">L'année n'est pas encore ouverte</DisplayTitle>
      {canOpen ? (
        <>
          <p className="text-muted-foreground">
            Cette page a besoin d'une année scolaire en cours (rôles, notes, points open,
            trésorerie). Crée-la : elle deviendra l'année en cours.
          </p>
          <Button asChild size="lg">
            <Link href="/manage/admin?tab=years">Créer l'année scolaire</Link>
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">
          Le BDE prépare la nouvelle année : cette page sera disponible très bientôt. Les
          événements, eux, sont déjà accessibles.
        </p>
      )}
      <Button asChild variant="outline">
        <Link href="/events">Voir les événements</Link>
      </Button>
    </div>
  );
}
