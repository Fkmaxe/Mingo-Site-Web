import Link from "next/link";
import { formatDateTime } from "@/lib/paris-time";
import { ACTION_LABELS, describeMovement } from "./labels";
import type { Movement } from "./types";

/** Timeline of inventory actions, latest first. `showItem`: global history. */
export function HistoryList({
  movements,
  showItem,
}: {
  movements: Movement[];
  showItem?: boolean;
}) {
  if (movements.length === 0) {
    return <p className="text-muted-foreground text-sm">Aucune action pour l'instant.</p>;
  }
  return (
    <ol className="flex flex-col gap-0 border-primary/20 border-l-2 pl-4">
      {movements.map((m) => (
        <li key={m.id} className="relative flex flex-col gap-0.5 pb-4">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary ring-4 ring-background"
          />
          <span className="text-sm">
            <strong className="font-semibold">{ACTION_LABELS[m.action]}</strong>
            {describeMovement(m.action, m.details)
              ? ` · ${describeMovement(m.action, m.details)}`
              : ""}
          </span>
          {showItem ? (
            <Link
              href={`/inventory/${m.item.id}`}
              className="w-fit font-semibold text-primary text-xs underline-offset-4 hover:underline"
            >
              {m.item.name} ({m.item.code})
            </Link>
          ) : null}
          {m.note ? <span className="text-xs italic">« {m.note} »</span> : null}
          <span className="text-muted-foreground text-xs">
            {formatDateTime(m.createdAt)} · {m.actor?.name ?? "compte supprimé"}
          </span>
        </li>
      ))}
    </ol>
  );
}
