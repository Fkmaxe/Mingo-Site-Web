import Link from "next/link";
import { FOOTER_NAV } from "../content/navigation";
import { ORGANIZATION } from "../content/organization";
import { confirmed } from "../content/pending";
import { SITE } from "../content/site";
import { confirmedSocialLinks } from "../content/social";
import { formatAddressInline, formatSiren, formatSiret } from "../format";
import { siteHref } from "../routes";
import { PalmBackdrop } from "./palm-backdrop";
import { SiteLogo } from "./site-logo";

const linkClass = "text-on-navy text-sm underline-offset-4 hover:underline";

/** Legal footer, navy in both themes. No animation: a legal block never depends on JavaScript. */
export function SiteFooter({ signedIn }: { readonly signedIn: boolean }) {
  const email = confirmed(ORGANIZATION.email);
  const socials = confirmedSocialLinks();
  const year = new Date().getFullYear();

  return (
    <footer className="surface-navy relative overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <PalmBackdrop className="text-on-navy opacity-[0.05]" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <SiteLogo variant="footer" />
            <p className="text-on-navy-muted text-sm leading-relaxed">
              <strong className="font-semibold text-on-navy">{SITE.domain}</strong> est le site
              officiel de l'association {ORGANIZATION.displayName}, bureau des étudiants de l'ESGI.
            </p>
          </div>

          <nav aria-label="Navigation de pied de page">
            <h2 className="eyebrow mb-3 text-on-navy-muted text-xs">Navigation</h2>
            <ul className="flex flex-col gap-2">
              {FOOTER_NAV.map((item) => (
                <li key={item.route}>
                  <Link href={siteHref(item.route)} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/partners" className={linkClass}>
                  Partenaires
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow mb-3 text-on-navy-muted text-xs">Espace étudiant</h2>
            <ul className="flex flex-col gap-2">
              {signedIn ? (
                <li>
                  <Link href="/home" className={linkClass}>
                    Mon espace
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/login" className={linkClass}>
                      Se connecter
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className={linkClass}>
                      Créer mon compte
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/events" className={linkClass}>
                  Billetterie
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-8">
            <div>
              <h2 className="eyebrow mb-3 text-on-navy-muted text-xs">L'association</h2>
              <ul className="flex flex-col gap-2 text-on-navy text-sm">
                <li>{ORGANIZATION.legalStatus}</li>
                <li>RNA {ORGANIZATION.rna}</li>
                <li>SIRET {formatSiret(ORGANIZATION.siret)}</li>
                {email ? (
                  <li>
                    <a className="underline underline-offset-4" href={`mailto:${email}`}>
                      {email}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
            {socials.length > 0 ? (
              <div>
                <h2 className="eyebrow mb-3 text-on-navy-muted text-xs">Nous suivre</h2>
                <ul className="flex flex-wrap gap-4">
                  {socials.map((link) => (
                    <li key={link.id}>
                      <a
                        href={confirmed(link.url)}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="text-on-navy text-sm underline underline-offset-4"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12 border-on-navy/20 border-t pt-6 text-on-navy-muted text-xs leading-relaxed">
          <p>
            {ORGANIZATION.legalName} — {ORGANIZATION.legalStatus} — RNA {ORGANIZATION.rna} — SIRET{" "}
            {formatSiret(ORGANIZATION.siret)} — SIREN {formatSiren(ORGANIZATION.siren)} —{" "}
            {formatAddressInline(ORGANIZATION.address)}
          </p>
          <p className="mt-2">
            © {year} {ORGANIZATION.legalName}
          </p>
        </div>
      </div>
    </footer>
  );
}
