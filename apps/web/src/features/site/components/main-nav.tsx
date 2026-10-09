"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "../content/navigation";
import { siteHref } from "../routes";

export function isActive(pathname: string, target: string): boolean {
  return target === "/" ? pathname === "/" : pathname.startsWith(target);
}

/** Desktop navigation. A client component: a layout cannot read the current path. */
export function MainNav({ items }: { readonly items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const target = siteHref(item.route);
          const active = isActive(pathname, target);
          return (
            <li key={item.route}>
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 font-medium text-sm transition-colors hover:bg-muted",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
