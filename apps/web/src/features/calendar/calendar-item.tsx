import { CalendarDays, CheckSquare, Users } from "lucide-react";
import Link from "next/link";
import { formatTime } from "@/lib/paris-time";
import { cn } from "@/lib/utils";
import type { CalendarItem } from "./types";

const KIND_ICONS = { event: CalendarDays, meeting: Users, task: CheckSquare } as const;

/** « 19:00 – 23:00 · Paris · Pôle Sport », « Délai · Tâche · Bureau ». */
function details(item: CalendarItem, withDay: string | null) {
  const time =
    item.allDay || !item.startsAt
      ? "Délai"
      : `${formatTime(item.startsAt)}${item.endsAt && item.kind === "event" ? ` – ${formatTime(item.endsAt)}` : ""}`;
  return [withDay, time, item.location, item.label, item.cancelled ? "annulé" : null]
    .filter(Boolean)
    .join(" · ");
}

/** An event, meeting or task deadline, linked to its page. `day` prefixes the date. */
export function CalendarItemRow({ item, day = null }: { item: CalendarItem; day?: string | null }) {
  const Icon = KIND_ICONS[item.kind];
  return (
    <li>
      <Link
        href={item.path}
        className="flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-primary/5 shadow-sm transition-colors hover:bg-accent/40"
      >
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "font-medium leading-tight",
              item.cancelled && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </span>
          <span className="text-muted-foreground text-xs first-letter:uppercase">
            {details(item, day)}
          </span>
        </span>
      </Link>
    </li>
  );
}
