import { describe, expect, it } from "vitest";
import { meetingsExpected, noShows, rate } from "./rules";

describe("rate", () => {
  it("rounds to 3 decimals and is null without a denominator", () => {
    expect(rate(2, 3)).toBe(0.667);
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 4)).toBe(1);
  });
});

describe("noShows", () => {
  it("is unknown before the event, never negative after", () => {
    expect(noShows(10, 0, false)).toBeNull();
    expect(noShows(10, 7, true)).toBe(3);
    expect(noShows(2, 3, true)).toBe(0);
  });
});

describe("meetingsExpected", () => {
  it("counts general meetings plus each pole's, once per pole", () => {
    const held = new Map<string | null, number>([
      [null, 2],
      ["sport", 3],
      ["com", 1],
    ]);
    expect(meetingsExpected(["sport"], held)).toBe(5);
    expect(meetingsExpected(["sport", "com", "sport"], held)).toBe(6);
    expect(meetingsExpected([], held)).toBe(2);
  });
});
