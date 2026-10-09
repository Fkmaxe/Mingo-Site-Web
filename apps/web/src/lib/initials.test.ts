import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it.each([
    ["Jeanne", "Durand", "JD"],
    ["jeanne", "de La Tour", "JD"],
    ["Camille", "", "C"],
    [" Élise ", " Ödegaard", "ÉÖ"],
  ])("%s %s -> %s", (first, last, expected) => {
    expect(initials(first, last)).toBe(expected);
  });
});
