import type { Metadata } from "next";
import { JsonLd } from "@/features/site/components/json-ld";
import { PageHeader } from "@/features/site/components/page-header";
import { SITE } from "@/features/site/content/site";
import { buildBreadcrumb, buildContactPage } from "@/features/site/json-ld";
import { buildPageMetadata } from "@/features/site/metadata";
import { siteHref } from "@/features/site/routes";
import { ContactChannels, ContactLocation } from "@/features/site/sections/contact";
import { env } from "@/lib/server-env";

export const metadata: Metadata = buildPageMetadata({
  route: "contact",
  title: "Contact",
  description: `Joindre le ${SITE.name}, bureau des étudiants de l'ESGI : adresse e-mail officielle sur le domaine ${SITE.domain} et siège social de l'association à Paris.`,
});

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Nous joindre"
        title="Contact"
        lead="Une question sur l'association ou ses événements ?"
      />
      <ContactChannels />
      <ContactLocation />
      <JsonLd data={buildContactPage(env.SITE_URL, siteHref("contact"))} />
      <JsonLd
        data={buildBreadcrumb(env.SITE_URL, [
          { name: "Accueil", path: siteHref("home") },
          { name: "Contact", path: siteHref("contact") },
        ])}
      />
    </>
  );
}
