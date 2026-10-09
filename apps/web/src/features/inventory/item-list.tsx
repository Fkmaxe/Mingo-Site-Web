import { Package } from "lucide-react";
import Link from "next/link";
import { ConditionBadge } from "./condition-badge";
import type { Item } from "./types";

function Availability({ item }: { item: Item }) {
  const late = item.overdue ? (
    <span className="font-semibold text-destructive text-xs">En retard</span>
  ) : null;
  if (item.kind === "stock") {
    return (
      <>
        <span className="text-muted-foreground text-xs">
          <strong className="font-semibold text-foreground">{item.available}</strong> /{" "}
          {item.quantity} dispo
        </span>
        {late}
      </>
    );
  }
  const out = item.checkouts[0];
  if (!out) return <span className="text-muted-foreground text-xs">Disponible</span>;
  return (
    late ?? (
      <span className="truncate font-semibold text-warning text-xs">Sorti · {out.holder}</span>
    )
  );
}

export function ItemList({ items, empty }: { items: Item[]; empty: string }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
        {empty}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card shadow-primary/5 shadow-sm">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/inventory/${item.id}`}
            className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50"
          >
            {item.photoUrl ? (
              // biome-ignore lint/performance/noImgElement: private photo through the web proxy.
              <img
                src={item.photoUrl}
                alt=""
                loading="lazy"
                className="size-14 shrink-0 rounded-xl bg-muted object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Package aria-hidden className="size-6" />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">{item.name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {item.code}
                {item.location ? ` · ${item.location.name}` : " · Lieu non renseigné"}
                {item.category ? ` · ${item.category.name}` : ""}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <ConditionBadge condition={item.condition} />
                <Availability item={item} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
