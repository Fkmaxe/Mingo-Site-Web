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
