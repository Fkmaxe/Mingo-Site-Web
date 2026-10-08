"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { niceMax } from "./format";

export type Bar = { key: string; label: string; value: number };

type Props = {
  title: string;
  /** What a value counts, for the tooltip and the table: "inscriptions". */
  unit: string;
  bars: Bar[];
  empty: string;
};

/**
 * Single-series column chart (no legend: the title names the series). Every column is its
 * own hover / focus target, wider than the painted bar; values stay reachable in the table.
 */
export function BarChart({ title, unit, bars, empty }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (bars.length === 0) {
    return (
      <figure className="flex flex-col gap-2">
        <figcaption className="font-bold font-display">{title}</figcaption>
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          {empty}
        </p>
      </figure>
    );
  }
  const top = niceMax(Math.max(...bars.map((b) => b.value)));
  const peak = bars.reduce((a, b) => (b.value > a.value ? b : a));
  const dense = bars.length > 12;
  const shown = bars.find((b) => b.key === active);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-bold font-display">{title}</span>
        <span aria-live="polite" className="text-muted-foreground text-sm">
          {shown ? (
            <>
              <strong className="font-semibold text-foreground">{shown.value}</strong> {unit} ·{" "}
              {shown.label}
            </>
          ) : null}
        </span>
      </figcaption>

      <div className="flex gap-2">
        {/* Y axis: 0 and the clean maximum (the gridlines' values). */}
        <div
          aria-hidden
          className="flex h-40 flex-col justify-between text-right text-muted-foreground text-xs tabular-nums"
        >
          <span>{top}</span>
          {/* Counts only: the middle tick is labelled when it is a whole number. */}
          <span>{Number.isInteger(top / 2) ? top / 2 : ""}</span>
          <span>0</span>
        </div>
        <div className="relative h-40 flex-1">
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            <span className="border-border border-t" />
            <span className="border-border border-t" />
            <span className="border-border border-t" />
          </div>
          <ul className="absolute inset-0 flex items-end gap-0.5">
            {bars.map((bar) => {
              const height = (bar.value / top) * 100;
              const on = bar.key === active;
              return (
                <li key={bar.key} className="flex h-full min-w-0 flex-1 justify-center">
                  <span
                    role="img"
                    aria-label={`${bar.label} : ${bar.value} ${unit}`}
                    onPointerEnter={() => setActive(bar.key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(bar.key)}
                    onBlur={() => setActive(null)}
                    className="relative flex h-full w-full items-end justify-center rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {bar === peak && bar.value > 0 ? (
                      <span
                        className="absolute font-semibold text-foreground text-xs tabular-nums"
                        style={{ bottom: `calc(${height}% + 4px)` }}
                      >
                        {bar.value}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity",
                        active !== null && !on && "opacity-50",
                      )}
                      style={{ height: `${Math.max(height, bar.value > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {/* X labels: all of them when they fit, else the first and the last. */}
      <div aria-hidden className="ml-8 flex gap-0.5 text-muted-foreground text-xs">
        {bars.map((bar, i) => (
          <span key={bar.key} className="min-w-0 flex-1 truncate text-center">
            {!dense || i === 0 || i === bars.length - 1 ? bar.label : ""}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-primary">Voir en tableau</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y">
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  {bar.label}
                </th>
                <td className="py-1.5 text-right font-semibold tabular-nums">{bar.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
