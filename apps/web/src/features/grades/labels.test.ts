import { describe, expect, it } from "vitest";
import { formatScore } from "./labels";

describe("formatScore", () => {
  it("writes French decimals without useless zeros", () => {
    expect([formatScore(15), formatScore(12.5), formatScore(12.25), formatScore(0.1)]).toEqual([
      "15",
      "12,5",
      "12,25",
      "0,1",
    ]);
  });
});
