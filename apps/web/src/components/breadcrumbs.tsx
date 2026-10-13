import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import type { Crumb } from "@/lib/breadcrumbs";

/**
 * Breadcrumb trail of a page: its parents, then the page itself. It follows the hierarchy of
 * the pages, not the browser history. On a phone only the link to the parent is shown.
 */
export function Breadcrumbs({ items, current }: { items: readonly Crumb[]; current: string }) {
  const parent = items.at(-1);
  if (!parent) return null;
  return (
    <nav aria-label="Fil d'Ariane" className="-mt-2 text-sm">
      <Link
        href={parent.href}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md pr-2 font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:hidden"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{parent.label}</span>
      </Link>
      <ol className="hidden min-h-11 flex-wrap items-center gap-1.5 text-muted-foreground md:flex">
        {items.map((item) => (
          <Fragment key={item.href}>
            <li>
              <Link
                href={item.href}
                className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item.label}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5" />
            </li>
          </Fragment>
        ))}
        <li aria-current="page" className="max-w-64 truncate font-semibold text-foreground">
          {current}
        </li>
      </ol>
    </nav>
  );
}
