import type { Metadata } from "next";
import { OG_IMAGE, SITE } from "./content/site";
import { type SiteRoute, siteHref } from "./routes";

/** Title, description, canonical URL and link preview of a showcase page. */
export function buildPageMetadata({
  route,
  title,
  description,
}: {
  readonly route: SiteRoute;
  readonly title: string;
  readonly description: string;
}): Metadata {
  const path = siteHref(route);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "fr_FR",
      title,
      description,
      url: path,
      images: [OG_IMAGE],
    },
  };
}
