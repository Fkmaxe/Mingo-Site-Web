import { Check, Server, UserRound } from "lucide-react";
import { LegalField, LegalPersonSheet, OfficialSiteNotice } from "../components/legal";
import { SectionShell } from "../components/section-shell";
import { CREDITS, HOST, ORGANIZATION, PUBLISHERS } from "../content/organization";
import { confirmed, isPending, pending } from "../content/pending";
import { SITE } from "../content/site";
import { confirmedSocialLinks } from "../content/social";

/** Publishers of the site: LCEN, article 6-III. */
export function LegalEditor() {
  const director = ORGANIZATION.publicationDirector;
  return (
    <SectionShell id="editeur" eyebrow="Obligation d'information" title="Éditeur du site">
      <div className="flex flex-col gap-8">
        <p className="max-w-3xl text-lg leading-relaxed">
          Le présent site, publié sous le nom de domaine{" "}
          <strong className="font-semibold">{SITE.domain}</strong> pour le compte de l'association{" "}
          {ORGANIZATION.legalName}, est édité par :
        </p>
        <ul className="grid gap-5 lg:grid-cols-2">
          {PUBLISHERS.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5 text-card-foreground sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <UserRound aria-hidden className="size-5" />
                </span>
                <h3 className="heading-display text-xl">{person.name}</h3>
              </div>
              <LegalPersonSheet person={person} />
            </li>
          ))}
        </ul>
        <dl className="max-w-3xl rounded-xl bg-pastel px-5 text-pastel-foreground">
          <LegalField
            label="Directeur de la publication"
            value={director}
            note={isPending(director) ? director.reason : undefined}
          />
        </dl>
      </div>
    </SectionShell>
  );
}

/** Host of the site: the second half of the identification duty. */
export function LegalHosting() {
  return (
    <SectionShell
      id="hebergement"
      tone="pastel"
      eyebrow="Obligation d'information"
      title="Hébergement"
      lead="L'identification de l'hébergeur est imposée par la loi au même titre que celle de l'éditeur."
    >
      <div className="rounded-2xl border bg-background p-5 text-foreground sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Server aria-hidden className="size-5" />
          </span>
          <h3 className="heading-display text-xl">Hébergeur du site</h3>
        </div>
        <LegalPersonSheet person={HOST} />
      </div>
    </SectionShell>
  );
}

/** Ties the domain name, the mailbox and the registrations to a single organization. */
export function LegalDomain() {
  const email = confirmed(ORGANIZATION.email);
  return (
    <SectionShell
      id="domaine"
      tone="brand"
      palms
      title={`${SITE.domain}, le site officiel de l'association`}
      lead="Le nom de domaine, la messagerie et les immatriculations publiques ci-dessous désignent une seule et même organisation."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
        <div className="flex flex-col gap-5">
          <OfficialSiteNotice withIdentifiers className="text-base text-on-navy leading-relaxed" />
          {email ? (
            <p className="text-base text-on-navy leading-relaxed">
              L'adresse électronique officielle de l'association,{" "}
              <a href={`mailto:${email}`} className="font-semibold underline underline-offset-4">
                {email}
              </a>
              , utilise ce même nom de domaine.
            </p>
          ) : null}
          <p className="text-base text-on-navy-muted leading-relaxed">
            Le domaine n'est exploité par aucune autre entité et ne redirige vers aucun autre site.
          </p>
        </div>
        <dl className="grid gap-3 self-start">
          <div className="rounded-xl border border-on-navy/25 bg-on-navy/5 px-5 py-4">
            <dt className="eyebrow text-on-navy-muted text-xs">Nom de domaine</dt>
            <dd className="mt-1 font-semibold text-base text-on-navy">{SITE.domain}</dd>
          </div>
          {email ? (
            <div className="rounded-xl border border-on-navy/25 bg-on-navy/5 px-5 py-4">
              <dt className="eyebrow text-on-navy-muted text-xs">
                Adresse électronique officielle
              </dt>
              <dd className="mt-1 font-semibold text-base text-on-navy">{email}</dd>
            </div>
          ) : null}
          <div className="rounded-xl border border-on-navy/25 bg-on-navy/5 px-5 py-4">
            <dt className="eyebrow text-on-navy-muted text-xs">Dénomination</dt>
            <dd className="mt-1 font-semibold text-base text-on-navy">{ORGANIZATION.legalName}</dd>
          </div>
        </dl>
      </div>
    </SectionShell>
  );
}

/** What the platform really processes: the site has accounts since it hosts the student space. */
const STATEMENTS = [
  {
    title: "Comptes étudiants",
    body: "Un compte se crée uniquement avec une adresse @myskolae.fr, confirmée par mail. Il sert à s'inscrire aux événements, recevoir ses billets et suivre ses points open.",
  },
  {
    title: "Données traitées",
    body: "Prénom, nom, adresse e-mail, promo, inscriptions, présences et points open. Pour les membres du BDE : rôles, tâches et suivi de participation. Les sessions de connexion conservent l'adresse IP et le navigateur utilisés, pour la sécurité du compte.",
  },
  {
    title: "Un seul cookie, de session",
    body: "Un cookie strictement nécessaire garde la connexion ouverte. Aucun cookie publicitaire ni de mesure d'audience : aucune bannière de consentement n'est donc nécessaire.",
  },
  {
    title: "Sur ton appareil",
    body: "Pour l'accès hors connexion, le navigateur garde une copie des billets. Les notifications ne sont envoyées que si tu les actives depuis ton profil.",
  },
  {
    title: "Aucune mesure d'audience",
    body: "Pas de statistiques de visite, pas de traceur publicitaire, pas de profilage, pas de revente ni de partage avec une régie.",
  },
  {
    title: "Aucun service tiers de suivi",
    body: "Les polices de caractères sont auto-hébergées. L'affichage des pages ne déclenche aucune requête vers un service externe de suivi.",
  },
] as const;

const RETENTION = pending("Durées de conservation des données à fixer par le bureau.");

export function LegalPrivacy() {
  const email = confirmed(ORGANIZATION.email);
  return (
    <SectionShell
      id="donnees-personnelles"
      eyebrow="RGPD et traceurs"
      title="Données personnelles et cookies"
      lead="Le site héberge l'espace étudiant du BDE : voici ce qui est traité, et pourquoi."
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {STATEMENTS.map((statement) => (
          <li
            key={statement.title}
            className="flex gap-4 rounded-2xl border bg-card p-5 text-card-foreground"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground">
              <Check aria-hidden className="size-4" />
            </span>
            <div>
              <h3 className="heading-display text-base">{statement.title}</h3>
              <p className="mt-1 text-sm leading-relaxed">{statement.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl bg-pastel p-5 text-pastel-foreground sm:p-8">
        <dl className="grid gap-0">
          <LegalField label="Responsable du traitement" value={ORGANIZATION.legalName} />
          <LegalField label="Finalité">
            Gestion des événements du BDE, des inscriptions, de la billetterie, des points open et
            de la vie interne de l'association.
          </LegalField>
          <LegalField label="Durée de conservation" value={RETENTION} />
          <LegalField label="Tes droits">
            Accès, rectification, effacement, limitation et opposition
            {email ? (
              <>
                {" "}
                : écris à{" "}
                <a href={`mailto:${email}`} className="underline underline-offset-4">
                  {email}
                </a>
              </>
            ) : null}
            . Ton prénom et ton nom se modifient directement depuis ton profil. Tu peux aussi
            adresser une réclamation à la CNIL.
          </LegalField>
        </dl>
      </div>
    </SectionShell>
  );
}

const TECHNOLOGIES = ["Next.js", "React", "Tailwind CSS", "shadcn/ui", "Hono", "PostgreSQL"];

export function LegalCredits() {
  const socials = confirmedSocialLinks();
  return (
    <SectionShell id="credits" tone="pastel" eyebrow="Conception et ressources" title="Crédits">
      <div className="rounded-2xl border bg-background p-5 text-foreground sm:p-8">
        <dl className="grid gap-0">
          <LegalField label="Réalisation du site" value={CREDITS.siteAuthor} />
          <LegalField label="Logo et mascotte" value={CREDITS.logoAuthor} />
          <LegalField label="Technologies">
            <ul className="flex flex-wrap gap-2">
              {TECHNOLOGIES.map((technology) => (
                <li key={technology} className="rounded-full border px-2.5 py-0.5 text-xs">
                  {technology}
                </li>
              ))}
            </ul>
          </LegalField>
          <LegalField
            label="Polices de caractères"
            note="Auto-hébergées avec le site : leur affichage ne déclenche aucune requête vers un service tiers."
          >
            Barlow Condensed, Inter et Poppins, distribuées sous licence SIL Open Font License.
          </LegalField>
          {socials.length > 0 ? (
            <LegalField label="Réseaux de l'association">
              <ul className="flex flex-wrap gap-4">
                {socials.map((link) => (
                  <li key={link.id}>
                    <a
                      href={confirmed(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </LegalField>
          ) : null}
        </dl>
      </div>
    </SectionShell>
  );
}
