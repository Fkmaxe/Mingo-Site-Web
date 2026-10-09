import type { Metadata } from "next";
import { JsonLd } from "@/features/site/components/json-ld";
import { PageHeader } from "@/features/site/components/page-header";
import { SITE } from "@/features/site/content/site";
import { buildBreadcrumb } from "@/features/site/json-ld";
import { buildPageMetadata } from "@/features/site/metadata";
import { siteHref } from "@/features/site/routes";
import {
  LegalCredits,
  LegalDomain,
  LegalEditor,
  LegalHosting,
  LegalPrivacy,
} from "@/features/site/sections/legal";
import { env } from "@/lib/server-env";

const TITLE = "Mentions légales";

export const metadata: Metadata = buildPageMetadata({
  route: "legal",
  title: TITLE,
  description: `Éditeurs, hébergement, données personnelles et crédits de ${SITE.domain}, le site officiel du ${SITE.name}.`,
});

export default function LegalNoticePage() {
  return (
    <>
      <PageHeader
        eyebrow="Informations légales"
        title={TITLE}
        lead="Éditeurs, hébergeur, données personnelles et crédits du site."
      />
      <LegalEditor />
      <LegalHosting />
      <LegalDomain />
      <LegalPrivacy />
      <LegalCredits />
      <JsonLd
        data={buildBreadcrumb(env.SITE_URL, [
          { name: "Accueil", path: siteHref("home") },
          { name: TITLE, path: siteHref("legal") },
        ])}
      />
    </>
  );
}
