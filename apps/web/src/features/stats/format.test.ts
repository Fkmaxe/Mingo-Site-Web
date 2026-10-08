import { describe, expect, it } from "vitest";
import { formatRate, niceMax, shortDay, shortMonth } from "./format";

describe("stats formatting", () => {
  it("formats rates as whole percentages", () => {
    expect(formatRate(0.667)).toBe("67 %");
    expect(formatRate(null)).toBe("—");
  });

  it("rounds the axis up to 1, 2 or 5 times a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(100)).toBe(100);
  });

  it("names months and days in French", () => {
    expect(shortMonth("2026-10")).toBe("oct.");
    expect(shortDay("2026-02-08")).toBe("8 févr.");
  });
});
