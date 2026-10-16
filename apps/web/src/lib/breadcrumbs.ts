/** A parent page in a breadcrumb trail. */
export type Crumb = { label: string; href: string };

export const HOME: Crumb = { label: "Accueil", href: "/home" };
/** Home of a visitor: the showcase site. */
export const SITE_HOME: Crumb = { label: "Accueil", href: "/" };
export const MANAGE: Crumb = { label: "Gestion", href: "/manage" };
export const MANAGE_EVENTS: Crumb = { label: "Événements", href: "/manage/events" };
export const OPEN_POINTS: Crumb = { label: "Points open", href: "/manage/open-points" };
export const APPLICATIONS: Crumb = { label: "Candidatures", href: "/manage/applications" };
export const TREASURY: Crumb = { label: "Trésorerie", href: "/manage/treasury" };
export const EVENTS: Crumb = { label: "Événements", href: "/events" };
export const TICKETS: Crumb = { label: "Mes billets", href: "/tickets" };
export const INVENTORY: Crumb = { label: "Inventaire", href: "/inventory" };
export const MEETINGS: Crumb = { label: "Réunions", href: "/meetings" };
export const TASKS: Crumb = { label: "Tâches", href: "/tasks" };
export const TEAM: Crumb = { label: "L'équipe", href: "/team" };
export const PARTNERS: Crumb = { label: "Partenaires", href: "/team/partners" };

/** Trail of the management pages: Accueil › Gestion › … */
export const manageTrail = (...rest: Crumb[]): Crumb[] => [HOME, MANAGE, ...rest];
