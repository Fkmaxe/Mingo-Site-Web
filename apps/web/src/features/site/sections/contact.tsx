import { AtSign, ExternalLink, MapPin, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyEmailButton } from "../components/copy-email-button";
import { LegalField, PendingValue } from "../components/legal";
import { SectionShell } from "../components/section-shell";
import { ORGANIZATION } from "../content/organization";
import { confirmed, isPending } from "../content/pending";
import { SITE } from "../content/site";
import { confirmedSocialLinks, socialCaption } from "../content/social";
import { formatSiren, formatSiret, mapSearchUrl } from "../format";

const chip =
  "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold text-xs";

/**
 * The channels that actually reach the association. The address is plain, large, clickable
 * text: it depends neither on JavaScript nor on the copy button.
 */
export function ContactChannels() {
  const email = confirmed(ORGANIZATION.email);
  const socials = confirmedSocialLinks();
  return (
    <SectionShell
      id="nous-ecrire"
      eyebrow="Canaux officiels"
      title="Nous écrire"
      lead="Écris directement au bureau depuis ta messagerie : c'est le canal officiel de l'association, et le plus court."
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-5 rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 sm:p-6 lg:col-span-3">
          <span className={cn(chip, "bg-secondary text-secondary-foreground")}>
            <AtSign aria-hidden className="size-3.5" />
            Contact principal
          </span>
          <h3 className="heading-display text-xl">Adresse e-mail officielle</h3>
          <div aria-hidden className="h-1.5 w-16 rounded-full bg-accent" />
          {email ? (
            <a
              href={`mailto:${email}`}
              className="block break-words font-semibold text-2xl tracking-tight underline decoration-2 underline-offset-8 sm:text-3xl lg:text-4xl"
            >
              {email}
            </a>
          ) : (
            <PendingValue
              reason={isPending(ORGANIZATION.email) ? ORGANIZATION.email.reason : undefined}
            />
          )}
          {email ? <CopyEmailButton email={email} /> : null}
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cette adresse utilise le nom de domaine officiel de l'association,{" "}
            <strong className="font-semibold text-card-foreground">{SITE.domain}</strong>.
          </p>
        </div>

        <div
          className={cn(
            "flex flex-col gap-5 rounded-2xl p-5 sm:p-6 lg:col-span-2",
            socials.length > 0
              ? "bg-card text-card-foreground ring-1 ring-foreground/10"
              : "border border-dashed bg-card/40",
          )}
        >
          <span className={cn(chip, "border")}>
            <Share2 aria-hidden className="size-3.5" />
            Communauté
          </span>
          <h3 className="heading-display text-xl">Nous suivre</h3>
          {socials.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {socials.map((link) => {
                const url = confirmed(link.url);
                if (!url) return null;
                return (
                  <li key={link.id}>
                    <a
                      href={url}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 py-2.5 hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {link.label}
                          <span className="sr-only"> (nouvelle fenêtre)</span>
                        </span>
                        <span className="text-muted-foreground text-xs">{socialCaption(link)}</span>
                      </span>
                      <ExternalLink aria-hidden className="size-4 shrink-0" />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Aucun compte public n'est publié pour le moment. L'adresse e-mail reste le moyen sûr
              de nous joindre.
            </p>
          )}
        </div>
      </div>

      <div className="gradient-tropical mt-8 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
        <ShieldCheck aria-hidden className="size-8 shrink-0 text-on-navy" />
        <p className="text-on-navy-muted text-sm leading-relaxed">
          Cette page ne propose{" "}
          <strong className="font-semibold text-on-navy">aucun formulaire de contact</strong> : les
          messages partent de ta propre messagerie, jamais d'ici. Aucune donnée personnelle n'est
          collectée sur cette page.
        </p>
      </div>
    </SectionShell>
  );
}

/** The registered office, as an <address>. No embedded map: an iframe would drop cookies. */
export function ContactLocation() {
  const address = ORGANIZATION.address;
  return (
    <SectionShell
      id="nous-trouver"
      tone="pastel"
      palms
      eyebrow="Sur place"
      title="Nous trouver"
      lead="L'association est domiciliée dans les locaux de l'ESGI, à Paris."
    >
      <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
        <div className="lg:col-span-3">
          <div className="badge-frame bg-background p-6 text-foreground sm:p-8">
            <p className="eyebrow text-muted-foreground text-xs">Siège social</p>
            <address className="mt-4 not-italic">
              <span className="block font-semibold text-xl leading-snug sm:text-2xl">
                {address.organizationName}
              </span>
              <span className="mt-1 block text-lg leading-relaxed sm:text-xl">
                {address.streetAddress}
              </span>
              <span className="block text-lg leading-relaxed sm:text-xl">
                {address.postalCode} {address.addressLocality}
              </span>
              <span className="block text-lg leading-relaxed sm:text-xl">
                {address.addressCountry}
              </span>
            </address>
            <Button asChild size="lg" className="mt-7">
              <a href={mapSearchUrl(address)} rel="noopener noreferrer" target="_blank">
                <MapPin aria-hidden />
                Ouvrir dans un plan
                <span className="sr-only"> (nouvelle fenêtre)</span>
                <ExternalLink aria-hidden />
              </a>
            </Button>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              Aucune carte n'est intégrée à cette page : le lien ouvre un service de cartographie
              externe dans un nouvel onglet.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <h3 className="eyebrow text-muted-foreground text-xs">Ce que disent les registres</h3>
          <p className="mt-3 text-base leading-relaxed">
            Cette adresse est le siège social déclaré au répertoire national des associations (RNA)
            et au répertoire SIRENE. C'est la même adresse que celle des mentions légales et du pied
            de page.
          </p>
          <dl className="mt-6 grid gap-0">
            <LegalField label="Numéro RNA" value={ORGANIZATION.rna} />
            <LegalField label="SIRET" value={formatSiret(ORGANIZATION.siret)} />
            <LegalField label="SIREN" value={formatSiren(ORGANIZATION.siren)} />
          </dl>
        </div>
      </div>
    </SectionShell>
  );
}
