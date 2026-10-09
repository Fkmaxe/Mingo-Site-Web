import { cn } from "@/lib/utils";
import { CONDITION_LABELS, CONDITION_TONES } from "./labels";
import type { ItemCondition } from "./types";

export function ConditionBadge({ condition }: { condition: ItemCondition }) {
  return (
    <span
      className={cn(
        "w-fit rounded-full px-2 py-0.5 font-semibold text-xs",
        CONDITION_TONES[condition],
      )}
    >
      {CONDITION_LABELS[condition]}
    </span>
  );
}
