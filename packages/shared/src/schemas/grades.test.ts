import { describe, expect, it } from "vitest";
import { CreateGradePeriodInput, computeFinalScore, SaveGradeInput } from "./grades";

describe("computeFinalScore", () => {
  it("adds presence and pole points, capped by the scale", () => {
    expect(computeFinalScore(8, 7, 20)).toBe(15);
    expect(computeFinalScore(20, 0, 20)).toBe(20);
    expect(computeFinalScore(0, 20, 20)).toBe(20);
    expect(computeFinalScore(15, 12, 20)).toBe(20);
    expect(computeFinalScore(2.5, 0.25, 20)).toBe(2.75);
  });
});

describe("grade inputs", () => {
  it("applies the defaults of a period", () => {
    expect(
      CreateGradePeriodInput.parse({ label: "T1", startsOn: "2026-09-01", endsOn: "2026-12-31" }),
    ).toMatchObject({ scaleMax: 20, pointsPerPresence: 1 });
  });

  it("rejects an end before the start and more than 2 decimals", () => {
    expect(
      CreateGradePeriodInput.safeParse({
        label: "T1",
        startsOn: "2026-09-01",
        endsOn: "2026-08-01",
      }).error?.issues[0]?.message,
    ).toBe("La fin doit être après le début");
    expect(
      SaveGradeInput.safeParse({
        membershipId: "0b7f1f0e-6a59-4c8a-9a5d-3a1d6c3c2f10",
        involvementPoints: 1.234,
      }).error?.issues[0]?.message,
    ).toBe("2 décimales maximum");
  });
});
