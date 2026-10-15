import { describe, expect, it } from "vitest";
import { monthWeeks, parseMonth, shiftMonth } from "./month";

describe("monthWeeks", () => {
  it("covers the month in full weeks starting on Monday", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const weeks = monthWeeks("2026-11");
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toBe("2026-10-26");
    expect(weeks[0]?.[6]).toBe("2026-11-01");
    expect(weeks.at(-1)?.[0]).toBe("2026-11-30");
    expect(weeks.at(-1)?.[6]).toBe("2026-12-06");
  });

  it("does not add a week when the month ends on a Sunday", () => {
    // February 2027 starts on a Monday and ends on a Sunday: exactly 4 weeks.
    const weeks = monthWeeks("2027-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toBe("2027-02-01");
    expect(weeks.at(-1)?.[6]).toBe("2027-02-28");
  });
});

describe("shiftMonth and parseMonth", () => {
  it("moves across years and refuses bad values", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(parseMonth("2026-13", "2026-10")).toBe("2026-10");
    expect(parseMonth("2026-11", "2026-10")).toBe("2026-11");
    expect(parseMonth(undefined, "2026-10")).toBe("2026-10");
  });
});
