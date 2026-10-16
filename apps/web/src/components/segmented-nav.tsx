import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentedItem = { key: string; label: string; href: string };

/**
 * Tabs that are links (« À venir / Passés », boards, statuses): equal columns when they fit
 * (`fill`), a scrolling row otherwise. 44 px touch targets; the current one is `aria-current`.
 */
export function SegmentedNav({
  label,
  items,
  active,
  fill = false,
}: {
  label: string;
  items: SegmentedItem[];
  active: string | undefined;
  fill?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "rounded-lg bg-muted p-1 text-sm",
        fill ? "grid auto-cols-fr grid-flow-col" : "flex gap-1 overflow-x-auto",
      )}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={cn(
            "flex min-h-11 shrink-0 items-center justify-center rounded-md px-3 font-medium",
            active === item.key ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
