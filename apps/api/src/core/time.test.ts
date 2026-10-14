import { describe, expect, it } from "vitest";
import { parisDate } from "./time";

describe("parisDate", () => {
  it("gives the day in Paris, not in UTC", () => {
    expect(parisDate(new Date("2026-10-13T23:30:00Z"))).toBe("2026-10-14");
    expect(parisDate(new Date("2026-10-13T21:30:00Z"))).toBe("2026-10-13");
    expect(parisDate(new Date("2026-12-31T23:01:00Z"))).toBe("2027-01-01");
  });
});
