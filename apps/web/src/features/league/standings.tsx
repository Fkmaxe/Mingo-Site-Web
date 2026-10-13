import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import type { League } from "./types";

type Row = League["standings"][number];

const PODIUM_TONES = [
  "bg-brand-pink text-brand-pink-foreground",
  "bg-brand-cyan text-brand-navy",
  "bg-brand-lavender text-brand-navy",
];

/** Top 3 as a podium: 2nd, 1st, 3rd from left to right, the 1st higher. */
export function Podium({ rows }: { rows: Row[] }) {
  const [first, second, third] = rows;
  if (!first) return null;
  const step = (row: Row | undefined, height: string, tone: number) =>
    row ? (
      <li className="flex min-w-0 flex-1 flex-col items-center gap-2">
        <Avatar name={row.user.name} url={row.user.avatarUrl} size={tone === 0 ? 64 : 52} />
        <span className="line-clamp-2 text-center font-semibold text-sm leading-tight">
          {row.user.name}
        </span>
        <span
          className={cn(
            "flex w-full flex-col items-center justify-start rounded-t-2xl pt-2 font-display",
            height,
            PODIUM_TONES[tone],
          )}
        >
          <span className="font-extrabold text-2xl italic">{row.rank}</span>
          <span className="font-semibold text-xs">{row.points} pts</span>
        </span>
      </li>
    ) : (
      <li className="flex-1" aria-hidden />
    );
  return (
    <ol className="flex items-end gap-2" aria-label="Podium">
      {step(second, "h-20", 1)}
      {step(first, "h-28", 0)}
      {step(third, "h-14", 2)}
    </ol>
  );
}

export function StandingsList({ rows, meId }: { rows: Row[]; meId: string }) {
  return (
    <ol className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card shadow-primary/5 shadow-sm">
      {rows.map((row) => (
        <li
          key={row.user.id}
          className={cn(
            "flex min-h-16 items-center gap-3 px-3 py-2",
            row.user.id === meId && "bg-primary/8",
          )}
          aria-current={row.user.id === meId ? "true" : undefined}
        >
          <span className="w-7 shrink-0 text-center font-bold font-display tabular-nums">
            {row.rank}
          </span>
          <Avatar name={row.user.name} url={row.user.avatarUrl} size={40} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">
              {row.user.name}
              {row.user.id === meId ? (
                <span className="font-normal text-muted-foreground"> (toi)</span>
              ) : null}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {[row.user.promo, `${row.events} événement${row.events > 1 ? "s" : ""}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className="shrink-0 font-bold text-lg text-primary tabular-nums">
            {row.points}
            <span className="font-medium text-muted-foreground text-xs"> pts</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
