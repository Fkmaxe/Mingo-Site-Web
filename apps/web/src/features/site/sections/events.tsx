import { ArrowRight, CalendarOff, Mail, MessageCircle, Ticket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CopyEmailButton } from "../components/copy-email-button";
import { EventList } from "../components/event-card";
import { PendingValue } from "../components/legal";
import { SectionShell } from "../components/section-shell";
import { ORGANIZATION } from "../content/organization";
import { confirmed } from "../content/pending";
import { DISCORD } from "../content/social";
import type { ShowcaseEvent } from "../events";
import { siteHref } from "../routes";

/**
 * The calendar in two parts, straight from the API: what is ongoing or coming, then what has
 * already happened (the most direct proof of the association's activity).
 */
export function EventsBoard({
  current,
  past,
  now,
  signedIn,
}: {
  readonly current: readonly ShowcaseEvent[];
  readonly past: readonly ShowcaseEvent[];
  readonly now: Date;
  readonly signedIn: boolean;
}) {
  return (
    <SectionShell
      id="calendrier"
      palms
      eyebrow="Calendrier"
      title="Nos rendez-vous"
      lead="Clique sur un événement pour voir tous les détails et t'inscrire."
    >
      <div className="flex flex-col gap-14">
        <div className="flex flex-col gap-6">
          <h3 className="heading-display text-2xl sm:text-3xl">En cours et à venir</h3>
          {current.length > 0 ? (
            <EventList events={current} now={now} headingLevel="h4" />
          ) : (
            <div className="flex items-start gap-4 rounded-2xl border border-dashed p-6">
              <CalendarOff aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p className="max-w-xl text-muted-foreground text-sm leading-relaxed">
                Aucun rendez-vous n'est programmé pour le moment. Les prochains seront publiés ici
                dès que le bureau les aura arrêtés.
              </p>
            </div>
          )}
          {signedIn ? null : (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Ticket aria-hidden className="size-4 shrink-0" />
              Certains événements sont réservés aux étudiants connectés.
              <Link
                href="/login?next=%2Fevenements"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </p>
          )}
        </div>

        {past.length > 0 ? (
          <div className="flex flex-col gap-6">
            <h3 className="heading-display text-2xl sm:text-3xl">Déjà passés</h3>
            <EventList events={past} now={now} headingLevel="h4" />
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

const MESSAGE_HINTS = [
  "L'idée en une phrase, et ce qu'elle apporterait aux étudiants.",
  "Le format envisagé et le moment de l'année qui semble le plus juste.",
  "Un moyen de te recontacter, pour que le bureau puisse en discuter avec toi.",
] as const;

/** A channel for proposals; the Discord button only exists once its link is confirmed. */
export function EventsContact() {
  const email = confirmed(ORGANIZATION.email);
  const discordUrl = confirmed(DISCORD.url);
  return (
    <SectionShell
      id="proposer"
      tone="pastel"
      eyebrow="Participer"
      title="Une idée d'événement ?"
      lead="Une proposition d'étudiant a autant sa place qu'une idée du bureau. Écris-nous, elle sera lue."
    >
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <p className="eyebrow flex items-center gap-2 text-xs">
              <Mail aria-hidden className="size-4" />
              Écrire au bureau
            </p>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="heading-display w-fit break-all text-xl underline decoration-2 underline-offset-8 transition-colors hover:text-primary sm:text-2xl lg:text-3xl"
              >
                {email}
              </a>
            ) : (
              <PendingValue reason="Adresse de contact à préciser par le bureau." />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {email ? <CopyEmailButton email={email} /> : null}
            <Button asChild size="lg">
              <Link href={siteHref("contact")}>
                Voir la page contact
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            {discordUrl ? (
              <Button asChild size="lg" variant="secondary">
                <a href={discordUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  Rejoindre le Discord
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <aside className="rounded-2xl border bg-background p-6 text-foreground sm:p-8">
          <h3 className="eyebrow text-muted-foreground text-xs">Ce qu'un message peut dire</h3>
          <ul className="mt-5 flex flex-col gap-4">
            {MESSAGE_HINTS.map((hint) => (
              <li
                key={hint}
                className="border-b pb-4 text-sm leading-relaxed last:border-b-0 last:pb-0"
              >
                {hint}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </SectionShell>
  );
}
