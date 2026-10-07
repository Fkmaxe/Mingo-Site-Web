import { describe, expect, it } from "vitest";
import { formatEventRange, isoToParisInput, parisInputToIso } from "./paris-time";

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
