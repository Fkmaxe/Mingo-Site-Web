import type { Metadata } from "next";
import { JsonLd } from "@/features/site/components/json-ld";
import { PageHeader } from "@/features/site/components/page-header";
import { buildAboutPage, buildBreadcrumb } from "@/features/site/json-ld";
import { buildPageMetadata } from "@/features/site/metadata";
import { siteHref } from "@/features/site/routes";
import {
  AboutBureau,
  AboutHistory,
  AboutIdentity,
  AboutMission,
  AboutOfficial,
} from "@/features/site/sections/about";
import { env } from "@/lib/server-env";

const TITLE = "Qui sommes-nous";

export const metadata: Metadata = buildPageMetadata({
  route: "about",
  title: TITLE,
  description:
    "Identité légale du BDE Mingo, bureau des étudiants de l'ESGI : statut associatif, numéros d'immatriculation, siège social, mission, histoire et bureau.",
});

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="L'association"
        title={TITLE}
        lead="Identité légale, mission, histoire et bureau du BDE Mingo."
      />
      <AboutIdentity />
      <AboutMission />
      <AboutHistory />
      <AboutBureau />
      <AboutOfficial />
      <JsonLd data={buildAboutPage(env.SITE_URL, siteHref("about"))} />
      <JsonLd
        data={buildBreadcrumb(env.SITE_URL, [
          { name: "Accueil", path: siteHref("home") },
          { name: TITLE, path: siteHref("about") },
        ])}
      />
    </>
  );
}
