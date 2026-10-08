"use client";

import { CheckCircle2, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { Event } from "../events/types";
import {
  cancelRegistrationAction,
  createTeamAction,
  joinTeamAction,
  registerAction,
} from "./actions";
import { AnswersForm } from "./answers-form";
import { placesLabel } from "./places";
import { TeamCard } from "./team-card";
import { TeamForm, type TeamMode } from "./team-form";
import type { Team } from "./types";

type Props = { event: Event; signedIn: boolean; team?: Team | null };

/** Registration call to action, kept at the bottom of the screen within thumb reach. */
export function RegistrationPanel({ event, signedIn, team = null }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [asking, setAsking] = useState(false);
  const [teamMode, setTeamMode] = useState<TeamMode | null>(null);
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const mine = event.myRegistration?.status === "confirmed" ? event.myRegistration : null;
  const waiting = event.myRegistration?.status === "waitlisted" ? event.myRegistration : null;

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.ok) {
        setAsking(false);
        setTeamMode(null);
        setAnswerErrors({});
      } else {
        setError(result.message);
        // Server-side answer errors come as "answers.<key>".
        setAnswerErrors(
          Object.fromEntries(
            Object.entries(result.fieldErrors).flatMap(([path, message]) =>
              path.startsWith("answers.")
                ? [[path.slice("answers.".length), message]]
                : path === "name" || path === "code"
                  ? [[path, message]]
                  : [],
            ),
          ),
        );
      }
      setConfirmLeave(false);
      router.refresh();
    });

  const sizes =
    event.teamMinSize !== null && event.teamMaxSize !== null
      ? { min: event.teamMinSize, max: event.teamMaxSize }
      : null;
  const teamCard =
    sizes && team ? <TeamCard team={team} minSize={sizes.min} maxSize={sizes.max} /> : null;

  let content: React.ReactNode;
  if (mine) {
    content = (
      <>
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 aria-hidden className="size-5" />
          Tu es inscrit·e
        </p>
        {teamCard}
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
              {sizes ? "Confirmer : quitter l'équipe" : "Confirmer la désinscription"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>
              Retour
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
            {sizes ? "Quitter l'équipe et me désinscrire" : "Me désinscrire"}
          </Button>
        )}
      </>
    );
  } else if (waiting) {
    content = (
      <>
        <p className="font-medium">
          Tu es sur liste d'attente
          {waiting.waitlistPosition ? ` · position ${waiting.waitlistPosition}` : ""}
        </p>
        <p className="text-muted-foreground text-sm">
          Si une place se libère, tu passes inscrit·e automatiquement et tu reçois un mail.
        </p>
        {teamCard}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => cancelRegistrationAction(waiting.id))}
        >
          Quitter la liste d'attente
        </Button>
      </>
    );
  } else if (event.registrationState === "open" || event.registrationState === "full") {
    const label =
      event.registrationState === "full" ? "Rejoindre la liste d'attente" : "S'inscrire";
    content = !signedIn ? (
      <Button asChild size="lg">
        <Link href={`/login?next=${encodeURIComponent(`/events/${event.slug}`)}`}>
          Se connecter pour s'inscrire
        </Link>
      </Button>
    ) : sizes && teamMode ? (
      <TeamForm
        key={teamMode}
        mode={teamMode}
        fields={event.customFields}
        pending={pending}
        serverErrors={answerErrors}
        onCancel={() => setTeamMode(null)}
        onSubmit={(value, answers) =>
          run(() =>
            teamMode === "create"
              ? createTeamAction(event.id, value, answers)
              : joinTeamAction(event.id, value, answers),
          )
        }
      />
    ) : sizes ? (
      <>
        <p className="text-muted-foreground text-sm">
          Inscription par équipe de {sizesLabel(sizes)}.
          {event.registrationState === "full"
            ? " Toutes les places d'équipe sont prises : une nouvelle équipe va sur liste d'attente, rejoindre une équipe inscrite reste possible."
            : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => setTeamMode("create")}>
            Créer une équipe
          </Button>
          <Button size="lg" variant="outline" onClick={() => setTeamMode("join")}>
            Rejoindre
          </Button>
        </div>
      </>
    ) : asking ? (
      <AnswersForm
        fields={event.customFields}
        submitLabel={label}
        pending={pending}
        serverErrors={answerErrors}
        onCancel={() => setAsking(false)}
        onSubmit={(answers) => run(() => registerAction(event.id, answers))}
      />
    ) : (
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          event.customFields.length > 0 ? setAsking(true) : run(() => registerAction(event.id))
        }
      >
        {pending ? "Un instant…" : label}
      </Button>
    );
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

function sizesLabel({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} personne${min > 1 ? "s" : ""}` : `${min} à ${max} personnes`;
}
