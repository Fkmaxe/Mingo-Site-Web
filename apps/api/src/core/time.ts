const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

/** "19:42", Paris time: for user-facing messages built by the API. */
export function parisTime(date: Date): string {
  return timeFormatter.format(date);
}
