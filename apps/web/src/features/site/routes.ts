/** Every page of the showcase site. Nothing else builds these URLs by hand. */
export const SITE_ROUTES = {
  home: "/",
  about: "/qui-sommes-nous",
  events: "/evenements",
  contact: "/contact",
  legal: "/mentions-legales",
} as const;

export type SiteRoute = keyof typeof SITE_ROUTES;

export function siteHref(route: SiteRoute): string {
  return SITE_ROUTES[route];
}

/** An event's page in the app: details and registration. */
export function eventHref(slug: string): string {
  return `/events/${encodeURIComponent(slug)}`;
}
