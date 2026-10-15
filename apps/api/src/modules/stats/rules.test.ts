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
  const held = {
    general: 2,
    board: 4,
    leads: 1,
    byPole: new Map([
      ["sport", 3],
      ["com", 1],
    ]),
  };
  const of = (poleIds: string[], role: { board?: boolean; lead?: boolean } = {}) =>
    meetingsExpected({ poleIds, board: false, lead: false, ...role }, held);

  it("counts general meetings plus each pole's, once per pole", () => {
    expect(of(["sport"])).toBe(5);
    expect(of(["sport", "com", "sport"])).toBe(6);
    expect(of([])).toBe(2);
  });

  it("adds the bureau + leads meetings for leads, and the bureau meetings for the bureau", () => {
    expect(of(["sport"], { lead: true })).toBe(6);
    expect(of([], { board: true })).toBe(7);
  });
});
