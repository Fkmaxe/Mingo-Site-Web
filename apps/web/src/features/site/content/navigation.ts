import type { SiteRoute } from "../routes";

export type NavItem = { readonly route: SiteRoute; readonly label: string };

export const MAIN_NAV: readonly NavItem[] = [
  { route: "home", label: "Accueil" },
  { route: "about", label: "Qui sommes-nous" },
  { route: "events", label: "Événements" },
  { route: "contact", label: "Contact" },
];

/** One click away from any page, as the law expects. */
export const LEGAL_NAV: NavItem = { route: "legal", label: "Mentions légales" };

export const FOOTER_NAV: readonly NavItem[] = [...MAIN_NAV, LEGAL_NAV];
