import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from ".";

describe("escapeText", () => {
  it("escapes the characters of a TEXT value", () => {
    expect(escapeText("Salle A; étage 2, bât. B\nAccès \\ libre")).toBe(
      "Salle A; étage 2\\, bât. B\\nAccès \\\\ libre",
    );
  });
});

describe("foldLine", () => {
  it("folds at 75 octets without cutting a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldLine(line).split("\r\n");
    const size = (s: string) => new TextEncoder().encode(s).length;
    expect(size(folded[0] ?? "")).toBeLessThanOrEqual(75);
    for (const next of folded.slice(1)) {
      expect(next.startsWith(" ")).toBe(true);
      expect(size(next)).toBeLessThanOrEqual(75);
    }
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(line);
    expect(foldLine("SHORT:ok")).toBe("SHORT:ok");
  });
});

describe("buildIcs", () => {
  it("writes timed events in UTC and whole-day events as dates", () => {
    const ics = buildIcs(
      {
        name: "BDE Mingo",
        description: "Agenda",
        events: [
          {
            uid: "event-1@bde",
            summary: "Gala",
            location: "Paris",
            start: new Date("2026-10-14T17:30:00.000Z"),
            end: new Date("2026-10-14T22:00:00.000Z"),
            url: "https://bde.example/events/gala",
          },
          { uid: "task-1@bde", summary: "Tâche : affiches", day: "2026-10-31", cancelled: true },
        ],
      },
      new Date("2026-10-01T08:00:00.000Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261014T173000Z\r\nDTEND:20261014T220000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261001T080000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101\r\n");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
