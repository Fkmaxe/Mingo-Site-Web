import { House, type LucideIcon, UserRound } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Main navigation. Lot 1 adds events and tickets here. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Accueil", icon: House },
  { href: "/profile", label: "Profil", icon: UserRound },
];
