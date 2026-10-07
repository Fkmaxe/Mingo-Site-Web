/** The BDE lives in Paris: dates are entered and displayed in Paris time, whatever the server TZ. */
export const TIME_ZONE = "Europe/Paris";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant -> value of an `<input type="datetime-local">` in Paris time. */
export function isoToParisInput(iso: string): string {
  const p = parisParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Value of an `<input type="datetime-local">` read as Paris time -> ISO instant. Null if invalid. */
export function parisInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Paris is UTC+1 or UTC+2: correct the guess by the observed offset, twice for DST edges.
  let instant = wanted;
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(instant));
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    instant += wanted - seen;
  }
  return new Date(instant).toISOString();
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function sameParisDay(a: Date, b: Date) {
  const pa = parisParts(a);
  const pb = parisParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/** "samedi 12 octobre · 19:00 – 23:00", or both days when it spans several. */
export function formatEventRange(startsAt: string, endsAt: string, short = false): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = short ? shortDayFormatter : dayFormatter;
  if (sameParisDay(start, end)) {
    return `${day.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
  }
  return `${day.format(start)} ${timeFormatter.format(start)} → ${day.format(end)} ${timeFormatter.format(end)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dayFormatter.format(date)} à ${timeFormatter.format(date)}`;
}
