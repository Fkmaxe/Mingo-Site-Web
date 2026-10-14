import { describe, expect, it } from "vitest";
import { classCode, promoLabel, UpdateClassInput } from "./classes";

const LEVEL = "00000000-0000-4000-8000-000000000001";

describe("classCode", () => {
  it.each([
    // From 3A (alternance only): the programme's code.
    ["4", "AL", "alternance", 1, true, "4AL1"],
    ["3", "MCSI", "alternance", 2, true, "3MCSI2"],
    ["3", null, "alternance", 4, true, "3A4"],
    // 1A, 2A: the rhythm's letter, whatever the programme (tronc commun or MCSI).
    ["1", null, "alternance", 3, false, "1A3"],
    ["2", null, "initial", 8, false, "2I8"],
    ["1", "MCSI", "initial", 2, false, "1I2"],
    ["2", "MCSI", "alternance", 5, false, "2A5"],
    ["1", "MCSI", null, 6, false, "16"],
    [null, "AL", "alternance", 1, true, null],
    ["4", "AL", "alternance", null, true, null],
  ] as const)(
    "%s %s %s %s (alternance only: %s) -> %s",
    (level, track, rhythm, number, only, expected) => {
      expect(classCode(level, track, rhythm, number, only)).toBe(expected);
    },
  );
});

describe("promoLabel", () => {
  it("puts the code first and the January intake last", () => {
    expect(
      promoLabel({
        code: "1A3",
        level: "1A",
        track: "Tronc commun",
        rhythm: "alternance",
        januaryIntake: true,
      }),
    ).toBe("1A3 · 1A · Tronc commun · Alternance · Rentrée de janvier");
  });

  it("leaves out what is missing", () => {
    expect(promoLabel({ code: "4AL1", level: "4A", track: "Architecture logicielle" })).toBe(
      "4AL1 · 4A · Architecture logicielle",
    );
    expect(promoLabel({ level: "3A", track: null })).toBe("3A");
    expect(promoLabel({ level: null, track: null, januaryIntake: true })).toBeNull();
  });
});

describe("UpdateClassInput", () => {
  it("requires the class number once a year is chosen", () => {
    const result = UpdateClassInput.safeParse({ levelId: LEVEL, trackId: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["classNumber"]);
  });

  it("defaults to no January intake and accepts 1 to 9", () => {
    expect(UpdateClassInput.parse({ levelId: LEVEL, trackId: null, classNumber: 9 })).toEqual({
      levelId: LEVEL,
      trackId: null,
      rhythm: null,
      classNumber: 9,
      januaryIntake: false,
    });
    expect(
      UpdateClassInput.safeParse({ levelId: LEVEL, trackId: null, classNumber: 10 }).success,
    ).toBe(false);
  });

  it("lets an empty class through", () => {
    expect(UpdateClassInput.safeParse({ levelId: null, trackId: null }).success).toBe(true);
  });
});
