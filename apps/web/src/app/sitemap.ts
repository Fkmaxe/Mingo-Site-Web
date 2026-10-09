import type { MetadataRoute } from "next";
import { type SiteRoute, siteHref } from "@/features/site/routes";
import { env } from "@/lib/server-env";

const PAGES: readonly { route: SiteRoute; priority: number }[] = [
  { route: "home", priority: 1 },
  { route: "events", priority: 0.9 },
  { route: "about", priority: 0.8 },
  { route: "contact", priority: 0.7 },
  { route: "legal", priority: 0.5 },
];

/** Public pages only: the signed-in app is not meant for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map(({ route, priority }) => ({
      url: new URL(siteHref(route), env.SITE_URL).toString(),
      priority,
      changeFrequency: "weekly" as const,
    })),
    { url: new URL("/events", env.SITE_URL).toString(), priority: 0.6 },
    { url: new URL("/partners", env.SITE_URL).toString(), priority: 0.4 },
  ];
}
