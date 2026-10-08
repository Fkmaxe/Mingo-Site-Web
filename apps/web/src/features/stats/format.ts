/** "67 %" for 0.667; "—" when there is nothing to compute yet. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

/** Clean axis maximum (1, 2, 5 × 10^n) at or above the largest value. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((s) => s * power >= max) ?? 10;
  return step * power;
}

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** "2026-10" -> "oct."; "2026-10-08" -> "8 oct.". */
export function shortMonth(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

export function shortDay(day: string): string {
  return `${Number(day.slice(8, 10))} ${shortMonth(day)}`;
}
