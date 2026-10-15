const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "19:42", Paris time: for user-facing messages built by the API. */
export function parisTime(date: Date): string {
  return timeFormatter.format(date);
}

/** "07/10/2026 19:42", Paris time: for exports. */
export function parisDateTime(date: Date): string {
  return dateTimeFormatter.format(date).replace(",", "");
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-14": the day in Paris (a `date` column), whatever the server TZ. */
export function parisDate(date: Date): string {
  return dateFormatter.format(date);
}

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hourCycle: "h23",
});

/** The hour in Paris (0–23), whatever the server TZ: for jobs that wait for the morning. */
export function parisHour(date: Date): number {
  return Number(hourFormatter.format(date));
}

/** The Paris day after `day` ("2026-10-31" → "2026-11-01"). */
export function nextParisDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
