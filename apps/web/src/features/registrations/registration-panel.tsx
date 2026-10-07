"use client";

import { CheckCircle2, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { Event } from "../events/types";
import { cancelRegistrationAction, registerAction } from "./actions";

type Props = { event: Event; signedIn: boolean };

function placesLabel(event: Event) {
  if (event.capacity === null) return `${event.confirmedCount} inscrit·e·s`;
  const left = Math.max(event.capacity - event.confirmedCount, 0);
  return `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur ${event.capacity}`;
}

/** Registration call to action, kept at the bottom of the screen within thumb reach. */
export function RegistrationPanel({ event, signedIn }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pending, startTransition] = useTransition();
  const mine = event.myRegistration?.status === "confirmed" ? event.myRegistration : null;

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message);
      setConfirmLeave(false);
      router.refresh();
    });

  let content: React.ReactNode;
  if (mine) {
    content = (
      <>
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 aria-hidden className="size-5" />
          Tu es inscrit·e
        </p>
        <Button asChild size="lg">
          <Link href={`/tickets/${mine.id}`}>
            <Ticket aria-hidden />
            Voir mon billet
          </Link>
        </Button>
        {confirmLeave ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => cancelRegistrationAction(mine.id))}
            >
              Confirmer la désinscription
            </Button>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>
              Retour
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
            Me désinscrire
          </Button>
        )}
      </>
    );
  } else if (event.registrationState === "open") {
    content = signedIn ? (
      <Button size="lg" disabled={pending} onClick={() => run(() => registerAction(event.id))}>
        {pending ? "Inscription…" : "S'inscrire"}
      </Button>
    ) : (
      <Button asChild size="lg">
        <Link href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}>
          Se connecter pour s'inscrire
        </Link>
      </Button>
    );
  } else if (event.registrationState === "full") {
    content = <p className="font-medium">L'événement est complet.</p>;
  } else {
    content = <p className="text-muted-foreground">Les inscriptions sont fermées.</p>;
  }

  return (
    <section
      aria-label="Inscription"
      className="sticky bottom-20 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:bottom-4"
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {event.status === "published" ? (
        <p className="text-muted-foreground text-sm">{placesLabel(event)}</p>
      ) : null}
      {content}
    </section>
  );
}
