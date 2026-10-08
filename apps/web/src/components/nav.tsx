"use client";

// Items (with their icon components) are built here from a boolean: functions cannot cross
// the server -> client boundary as props.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type NavItem, navItems } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile: fixed bar at the bottom, within thumb reach. Hidden from md up. */
export function BottomNav({ canManage = false }: { canManage?: boolean }) {
  const pathname = usePathname();
  const items: NavItem[] = navItems(canManage);
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-12px] shadow-primary/20 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 font-semibold text-[0.7rem]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: sidebar. Hidden below md. */
export function SideNav({ canManage = false }: { canManage?: boolean }) {
  const pathname = usePathname();
  const items: NavItem[] = navItems(canManage);
  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-full px-4 font-semibold text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
