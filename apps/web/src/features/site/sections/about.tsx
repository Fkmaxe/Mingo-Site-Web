import { Quote, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LegalIdentity, OfficialSiteNotice } from "../components/legal";
import { Reveal } from "../components/reveal";
import { SectionShell } from "../components/section-shell";
import { ORGANIZATION } from "../content/organization";
import { TEAM } from "../content/team";
import { siteHref } from "../routes";

/** The block a checker looks for: plain-text identity, no JavaScript needed. */
export function AboutIdentity() {
  return (
    <SectionShell
      id="identite"
      eyebrow="Fiche d'identité"
      title="Identité de l'association"
      lead="Toutes les informations d'identité de l'association, telles qu'elles ont été déclarées. Chaque numéro est vérifiable auprès des registres publics."
      reveal={false}
    >
      <div className="rounded-2xl border bg-card px-5 py-3 text-card-foreground sm:px-8 sm:py-5">
        <LegalIdentity variant="full" />
      </div>
    </SectionShell>
  );
}

/** The declared purpose, with its source; nothing unconfirmed is added. */
export function AboutMission() {
  return (
    <SectionShell id="mission" tone="pastel" eyebrow="Objet statutaire" title="Notre mission">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-14">
        <figure className="badge-frame relative overflow-hidden bg-background p-6 text-foreground sm:p-10">
          <Quote
            aria-hidden
            className="absolute -top-2 right-4 size-16 text-muted-foreground opacity-15 sm:size-24"
          />
          <p className="relative max-w-md text-muted-foreground text-sm leading-relaxed">
            L'objet statutaire de l'association, défini à l'article 2 de ses statuts, porte sur :
          </p>
          <p className="relative mt-5 font-medium text-2xl leading-snug sm:text-3xl">
            {ORGANIZATION.mission}
          </p>
          <figcaption className="relative mt-8 border-t pt-5 text-muted-foreground text-sm leading-relaxed">
            {ORGANIZATION.missionSource}
            <span className="mt-1 block">
              Formulation de synthèse de l'objet déclaré : seul le texte intégral des statuts fait
              foi.
            </span>
          </figcaption>
        </figure>

        <Reveal delay={140} className="border-primary border-l-2 pl-5 sm:pl-6">
          <h3 className="heading-display text-xl">Ce que cela recouvre</h3>
          <p className="mt-3 text-base leading-relaxed">
            Le BDE Mingo est le bureau des étudiants de l'ESGI. Son activité s'exerce dans le cadre
            de cet objet, sans but lucratif.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            Les rendez-vous organisés dans ce cadre sont publiés sur la page Événements, avec leur
            date et leur lieu.
          </p>
        </Reveal>
      </div>
    </SectionShell>
  );
}

/** Vertical timeline of the documented milestones only. */
export function AboutHistory() {
  return (
    <SectionShell
      id="histoire"
      eyebrow="Repères"
      title="Notre histoire"
      lead="Les jalons documentés de l'association."
    >
      <div className="relative">
        <span aria-hidden className="absolute top-3 bottom-3 left-2 w-px bg-border" />
        <ol className="flex flex-col gap-12 pl-8 sm:pl-10">
          {ORGANIZATION.timeline.map((milestone, index) => (
            <Reveal as="li" key={milestone.id} delay={index * 120} className="relative">
              <span
                aria-hidden
                className="absolute top-2 -left-8 size-4 rounded-full border-2 border-primary bg-background sm:-left-10"
              />
              <p className="heading-display text-2xl text-primary sm:text-3xl">
                {milestone.dateISO ? (
                  <time dateTime={milestone.dateISO}>{milestone.date}</time>
                ) : (
                  milestone.date
                )}
              </p>
              <h3 className="mt-2 font-semibold text-xl sm:text-2xl">{milestone.title}</h3>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground leading-relaxed">
                {milestone.description}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}

export function AboutBureau() {
  return (
    <SectionShell
      id="bureau"
      tone="pastel"
      eyebrow="Les personnes"
      title="Le bureau"
      lead="L'association est animée par un bureau élu. Voici sa composition pour 2026."
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM.map((member, index) => (
          <Reveal as="li" key={member.id} delay={index * 80}>
            <div className="flex h-full flex-col gap-2 rounded-2xl bg-background p-5 text-foreground ring-1 ring-foreground/10">
              <p className="eyebrow text-muted-foreground text-xs">{member.role}</p>
              <h3 className="heading-display text-xl">{member.name}</h3>
            </div>
          </Reveal>
        ))}
      </ul>
    </SectionShell>
  );
}

/** Ties the domain name to the association and its registrations. */
export function AboutOfficial() {
  return (
    <SectionShell
      id="site-officiel"
      tone="brand"
      palms
      title="Le site officiel de l'association"
      className="text-on-navy"
    >
      <div className="badge-frame flex max-w-3xl flex-col gap-5 border border-on-navy/25 p-6 text-on-navy sm:p-8">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl border border-on-navy/25"
        >
          <ShieldCheck className="size-6" />
        </span>
        <OfficialSiteNotice withIdentifiers className="text-base text-on-navy" />
        <p className="text-on-navy-muted text-sm leading-relaxed">
          Les mêmes informations figurent en pied de page et sur la page des mentions légales, afin
          qu'elles restent accessibles depuis n'importe quelle page du site.
        </p>
        <div>
          <Button asChild variant="secondary" size="lg">
            <Link href={siteHref("legal")}>Consulter les mentions légales</Link>
          </Button>
        </div>
      </div>
    </SectionShell>
  );
}
