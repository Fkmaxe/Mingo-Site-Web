const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "sam. 12 déc. · 19:00 – 21:00" (Paris time). */
export function slotTime(slot: { startsAt: string; endsAt: string }): string {
  const start = new Date(slot.startsAt);
  return `${dayFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(new Date(slot.endsAt))}`;
}
