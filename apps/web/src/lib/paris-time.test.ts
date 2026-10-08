import { describe, expect, it } from "vitest";
import {
  dateBlock,
  formatEventRange,
  formatEventTimes,
  isoToParisInput,
  parisInputToIso,
} from "./paris-time";

describe("Paris time conversions", () => {
  it("converts in winter (UTC+1) and summer (UTC+2)", () => {
    expect(parisInputToIso("2026-12-10T19:00")).toBe("2026-12-10T18:00:00.000Z");
    expect(parisInputToIso("2026-06-10T19:00")).toBe("2026-06-10T17:00:00.000Z");
  });

  it("round-trips", () => {
    for (const iso of [
      "2026-10-24T21:30:00.000Z",
      "2027-01-15T12:00:00.000Z",
      "2027-07-01T06:45:00.000Z",
    ]) {
      const input = isoToParisInput(iso);
      expect(parisInputToIso(input)).toBe(iso);
    }
  });

  it("rejects malformed input", () => {
    expect(parisInputToIso("")).toBeNull();
    expect(parisInputToIso("10/12/2026 19:00")).toBeNull();
  });
});

describe("formatEventRange", () => {
  it("formats a same-day event in Paris time", () => {
    expect(formatEventRange("2026-12-12T18:00:00.000Z", "2026-12-12T22:00:00.000Z")).toBe(
      "samedi 12 décembre · 19:00 – 23:00",
    );
  });

  it("shows both days for a multi-day event", () => {
    expect(formatEventRange("2026-12-12T18:00:00.000Z", "2026-12-13T02:00:00.000Z")).toContain("→");
  });
});

describe("dateBlock", () => {
  it("uses the Paris day, even late in the evening UTC", () => {
    // 23:30 UTC on 31 October is 00:30 on 1 November in Paris (UTC+1 in winter).
    expect(dateBlock("2026-10-31T23:30:00.000Z")).toEqual({ day: "1", month: "nov." });
  });
});

describe("formatEventTimes", () => {
  it("shows the times only, and the end day when it spans two days", () => {
    expect(formatEventTimes("2026-12-10T18:00:00.000Z", "2026-12-10T22:00:00.000Z")).toBe(
      "19:00 – 23:00",
    );
    expect(formatEventTimes("2026-12-10T20:00:00.000Z", "2026-12-11T04:00:00.000Z")).toMatch(
      /^21:00 → .*11.* 05:00$/,
    );
  });
});
