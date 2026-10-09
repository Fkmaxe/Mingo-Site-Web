import { ALLOWED_EMAIL_DOMAIN } from "@bde/shared";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CopyEmailButton } from "../components/copy-email-button";
import { EventList } from "../components/event-card";
import { LegalIdentity, OfficialSiteNotice, PendingValue } from "../components/legal";
import { PalmBackdrop } from "../components/palm-backdrop";
import { SectionShell } from "../components/section-shell";
import { SiteLogo } from "../components/site-logo";
import { ORGANIZATION } from "../content/organization";
import { confirmed } from "../content/pending";
import { DISCORD } from "../content/social";
import { homeSelection, type ShowcaseEvent } from "../events";
import { siteHref } from "../routes";

/** Two columns: the pitch on the left, the flamingo on the right (above the text on phones). */
export function Hero({ signedIn }: { readonly signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-b bg-background">
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-secondary/30 via-background to-background"
      />
      <PalmBackdrop className="opacity-[0.07]" />
      <div
        aria-hidden
        className="absolute -top-32 -right-24 size-[26rem] rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-28">
        <div className="order-2 flex flex-col items-start gap-6 lg:order-1">
          <div className="flex flex-col gap-4">
            <h1 className="heading-display text-[clamp(3rem,11vw,6.5rem)] leading-[0.85]">
              {ORGANIZATION.legalName}
            </h1>
            <p className="font-medium text-foreground text-xl sm:text-2xl">
              Le bureau des étudiants de l'ESGI.
            </p>
            <p className="max-w-xl text-base text-muted-foreground leading-relaxed sm:text-lg">
              {ORGANIZATION.mission}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link href={siteHref("events")}>
                Voir les événements
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            {signedIn ? (
              <Button asChild variant="outline" size="lg">
                <Link href="/home">
                  <UserRound aria-hidden />
                  Mon espace
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="lg">
                <Link href="/login">
                  <LogIn aria-hidden />
                  Se connecter
                </Link>
              </Button>
            )}
          </div>

          <div className="flex w-full max-w-xl items-start gap-3 rounded-2xl border bg-card/60 px-4 py-3 text-card-foreground">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
            <OfficialSiteNotice className="text-foreground" />
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <div className="relative w-full max-w-[16rem] sm:max-w-md">
            <div aria-hidden className="absolute inset-10 rounded-full bg-accent/25 blur-3xl" />
            <SiteLogo variant="hero" className="float-slow relative mx-auto" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Only words of the statutory purpose: no « pillar » invented for the occasion. */
const PILLARS = [
  { id: "evenements", label: "Événements", Icon: CalendarDays },
  { id: "vie-etudiante", label: "Vie étudiante", Icon: Users },
  { id: "animation", label: "Animation", Icon: Sparkles },
] as const;

export function MissionPreview() {
  return (
    <SectionShell id="mission" eyebrow="L'association" title="Notre mission">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <p className="border-accent border-l-4 pl-5 font-medium text-2xl text-foreground leading-snug sm:text-3xl">
            {ORGANIZATION.mission}
          </p>
          <p className="max-w-xl text-base text-foreground leading-relaxed">
            Le {ORGANIZATION.displayName} est le bureau des étudiants de l'ESGI, à Paris.
          </p>
          <Button asChild variant="outline">
            <Link href={siteHref("about")}>
              Tout savoir sur l'association
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <ul className="flex flex-col gap-3">
          {PILLARS.map((pillar) => (
            <li
              key={pillar.id}
              className="flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 text-card-foreground"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <pillar.Icon aria-hidden className="size-5" />
              </span>
              <span className="eyebrow text-sm">{pillar.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

const PERKS = [
  {
    id: "inscriptions",
    Icon: CalendarDays,
    title: "Inscriptions en 2 clics",
    body: "Soirées, tournois, sorties : réserve ta place, ou rejoins la liste d'attente.",
  },
  {
    id: "billets",
    Icon: Ticket,
    title: "Ton billet dans la poche",
    body: "Un billet QR par événement, disponible même hors connexion.",
  },
  {
    id: "points",
    Icon: Sparkles,
    title: "Des points open",
    body: "Chaque événement te rapporte des points, suis ton solde en direct.",
  },
] as const;

/** Entry point to the app: what an account brings, and the way in. */
export function StudentSpace({ signedIn }: { readonly signedIn: boolean }) {
  return (
    <SectionShell
      id="espace-etudiant"
      tone="brand"
      palms
      title="Ton espace étudiant"
      lead={
        signedIn
          ? "Tes billets, tes inscriptions et tes points t'attendent."
          : `Crée ton compte avec ton adresse @${ALLOWED_EMAIL_DOMAIN} : c'est gratuit et ça prend une minute.`
      }
    >
      <div className="flex flex-col gap-8">
        <ul className="grid gap-4 sm:grid-cols-3">
          {PERKS.map((perk) => (
            <li
              key={perk.id}
              className="flex flex-col gap-3 rounded-2xl border border-on-navy/25 bg-on-navy/5 p-5"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-on-navy/10 text-on-navy">
                <perk.Icon aria-hidden className="size-5" />
              </span>
              <h3 className="heading-display text-on-navy text-xl">{perk.title}</h3>
              <p className="text-on-navy-muted text-sm leading-relaxed">{perk.body}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          {signedIn ? (
            <Button asChild size="lg" className="bg-on-navy text-site-navy hover:bg-on-navy/90">
              <Link href="/home">
                <UserRound aria-hidden />
                Aller dans mon espace
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="bg-on-navy text-site-navy hover:bg-on-navy/90">
                <Link href="/signup">
                  <UserRoundPlus aria-hidden />
                  Créer mon compte
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-on-navy/40 bg-transparent text-on-navy hover:bg-on-navy/10 hover:text-on-navy"
              >
                <Link href="/login">
                  <LogIn aria-hidden />
                  J'ai déjà un compte
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/** What is coming, or else the latest events: never an empty grid. */
export function EventsPreview({
  current,
  past,
  now,
}: {
  readonly current: readonly ShowcaseEvent[];
  readonly past: readonly ShowcaseEvent[];
  readonly now: Date;
}) {
  const { events, showingPast } = homeSelection(current, past);
  return (
    <SectionShell
      id="evenements"
      eyebrow="Programme"
      title="Événements"
      lead={
        showingPast
          ? "Aucun rendez-vous n'est programmé pour le moment. Voici les derniers organisés par le BDE."
          : "Les prochains rendez-vous du BDE Mingo. Inscris-toi directement depuis l'événement."
      }
    >
      <div className="flex flex-col gap-8">
        {events.length > 0 ? <EventList events={events} now={now} /> : null}
        <div className="flex flex-col gap-5 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-muted-foreground text-sm leading-relaxed">
            {showingPast
              ? "Le calendrier de la suite sera publié sur la page Événements."
              : "Les dates sont mises à jour dès que le bureau les arrête."}
          </p>
          <Button asChild variant="outline">
            <Link href={siteHref("events")}>
              Voir tous les événements
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </SectionShell>
  );
}

/** Identity at a glance from the home page; legal blocks never slide in. */
export function LegalSnapshot() {
  return (
    <SectionShell
      tone="pastel"
      id="informations-officielles"
      eyebrow="Identité légale"
      title="Informations officielles"
      lead="Le nom légal, le statut, les numéros d'immatriculation et le siège social de l'association."
      reveal={false}
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
        <div className="rounded-3xl border bg-background p-5 text-foreground shadow-xs sm:p-8">
          <LegalIdentity variant="compact" />
        </div>
        <aside className="flex flex-col items-start gap-5">
          <p className="text-pastel-foreground text-sm leading-relaxed">
            Les mentions légales complètes reprennent ces informations, ainsi que l'identité des
            éditeurs et de l'hébergeur du site.
          </p>
          <Button asChild variant="outline">
            <Link href={siteHref("legal")}>
              Mentions légales complètes
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </aside>
      </div>
    </SectionShell>
  );
}

/** Contact banner on a navy surface: the address is plain, selectable text. */
export function ContactCta() {
  const email = confirmed(ORGANIZATION.email);
  const discordUrl = confirmed(DISCORD.url);
  return (
    <SectionShell
      tone="brand"
      id="contact"
      palms
      title="Une question ?"
      lead="Une seule adresse, celle de l'association, sur son propre nom de domaine."
    >
      <div className="rounded-3xl border border-on-navy/25 bg-on-navy/5 p-5 sm:p-10">
        <p className="eyebrow text-on-navy-muted text-xs">Adresse officielle</p>
        {email ? (
          <>
            <a
              href={`mailto:${email}`}
              className="mt-4 block break-words font-semibold text-[clamp(1.5rem,5.5vw,3.25rem)] text-on-navy leading-tight tracking-tight underline-offset-8 hover:underline"
            >
              {email}
            </a>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <CopyEmailButton
                email={email}
                className="border-on-navy/40 bg-on-navy/10 text-on-navy hover:bg-on-navy/20 hover:text-on-navy"
              />
              <Link
                href={siteHref("contact")}
                className="text-on-navy text-sm underline underline-offset-4"
              >
                Voir la page Contact
              </Link>
              {discordUrl ? (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-on-navy text-sm underline underline-offset-4"
                >
                  Rejoindre le Discord
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 flex flex-wrap items-center gap-3 text-lg text-on-navy">
            <Mail aria-hidden className="size-5" />
            L'adresse de contact sera publiée ici.
            <PendingValue reason="Adresse de contact de l'association à confirmer." />
          </p>
        )}
      </div>
    </SectionShell>
  );
}
