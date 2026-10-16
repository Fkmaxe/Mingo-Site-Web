import { EVENT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Event } from "./types";

const STATUS_STYLES: Record<Event["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  done: "bg-secondary text-secondary-foreground",
};

export function StatusBadge({ status }: { status: Event["status"] }) {
  return (
    <span
      className={cn(
        "w-fit rounded-full px-2.5 py-0.5 font-semibold text-xs",
        STATUS_STYLES[status],
      )}
    >
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}
