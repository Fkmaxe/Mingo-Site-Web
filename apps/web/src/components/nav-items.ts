import {
  CalendarDays,
  House,
  type LucideIcon,
  Settings2,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Accueil", icon: House },
  { href: "/events", label: "Événements", icon: CalendarDays },
  { href: "/ligue", label: "Ligue", icon: Trophy },
  { href: "/tickets", label: "Billets", icon: Ticket },
  { href: "/profile", label: "Profil", icon: UserRound },
];

/** Shown to pole leads and the board. */
export const MANAGE_NAV_ITEM: NavItem = {
  href: "/manage",
  label: "Gestion",
  icon: Settings2,
};

export function navItems(canManage: boolean): NavItem[] {
  return canManage ? [...NAV_ITEMS.slice(0, 3), MANAGE_NAV_ITEM, ...NAV_ITEMS.slice(3)] : NAV_ITEMS;
}
