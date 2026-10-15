/**
 * Minimal iCalendar (RFC 5545) writer for read-only subscription feeds (Apple Calendar,
 * Google Agenda). No dependency: only VEVENT with UTC times or whole days is needed.
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  cancelled?: boolean;
} & ({ start: Date; end: Date } | { day: string });

export type IcsCalendar = { name: string; description: string; events: IcsEvent[] };

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, ";")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets, continuation lines starting with a space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // The first line holds 75 octets, the next ones 74 after their leading space.
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** 20261014T173000Z */
const utc = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
/** 2026-10-14 → 20261014 */
const dateValue = (day: string) => day.replace(/-/g, "");

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(calendar: IcsCalendar, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BDE Mingo//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-CALDESC:${escapeText(calendar.description)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    // Asks the apps to refresh hourly (Google decides on its own, about twice a day).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of calendar.events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${utc(now)}`);
    if ("day" in event) {
      lines.push(
        `DTSTART;VALUE=DATE:${dateValue(event.day)}`,
        `DTEND;VALUE=DATE:${dateValue(nextDay(event.day))}`,
        "TRANSP:TRANSPARENT",
      );
    } else {
      lines.push(`DTSTART:${utc(event.start)}`, `DTEND:${utc(event.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push(`STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
