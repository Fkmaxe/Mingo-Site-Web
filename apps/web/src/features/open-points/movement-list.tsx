import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPoints, OPEN_POINTS_STATUS_LABELS } from "./labels";
import type { OpenPointsMovement } from "./types";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
});

export function MovementList({ movements }: { movements: OpenPointsMovement[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        Aucun point pour l'instant. Participe aux événements du BDE pour en gagner.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {movements.map((m) => {
        const counted = m.status === "validated" || m.status === "exported";
        return (
          <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              {m.event ? (
                <Link href={`/events/${m.event.slug}`} className="font-medium hover:underline">
                  {m.event.title}
                </Link>
              ) : (
                <span className="font-medium">{m.reason}</span>
              )}
              <span className="text-muted-foreground text-xs">
                {dateFormatter.format(new Date(m.createdAt))} ·{" "}
                {OPEN_POINTS_STATUS_LABELS[m.status]}
              </span>
            </div>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                !counted && "text-muted-foreground",
                m.status === "rejected" && "line-through",
              )}
            >
              {formatPoints(m.delta, true)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
