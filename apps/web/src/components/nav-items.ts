import { CalendarDays, House, type LucideIcon, Settings2, UserRound } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Accueil", icon: House },
  { href: "/events", label: "Événements", icon: CalendarDays },
  { href: "/profile", label: "Profil", icon: UserRound },
];

/** Shown to pole leads and the board. */
export const MANAGE_NAV_ITEM: NavItem = {
  href: "/manage/events",
  label: "Gestion",
  icon: Settings2,
};

export function navItems(canManage: boolean): NavItem[] {
  return canManage ? [...NAV_ITEMS.slice(0, 2), MANAGE_NAV_ITEM, ...NAV_ITEMS.slice(2)] : NAV_ITEMS;
}
