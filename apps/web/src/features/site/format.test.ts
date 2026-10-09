import { describe, expect, it } from "vitest";
import { excerpt, formatDayWithYear, formatSiren, formatSiret } from "./format";

describe("identifiers", () => {
  it("groups the SIRET and SIREN digits", () => {
    expect(formatSiret("91888056800012")).toBe("918 880 568 00012");
    expect(formatSiren("992362822")).toBe("992 362 822");
  });

  it("leaves a malformed number untouched", () => {
    expect(formatSiret("123")).toBe("123");
  });
});

describe("formatDayWithYear", () => {
  it("uses the Paris calendar day", () => {
    // 23:30 UTC on the 13th is already the 14th in Paris.
    expect(formatDayWithYear("2026-09-13T23:30:00Z")).toBe("lundi 14 septembre 2026");
  });
});

describe("excerpt", () => {
  it("keeps short texts and flattens whitespace", () => {
    expect(excerpt("Une  soirée\n\nau bord du canal.")).toBe("Une soirée au bord du canal.");
  });

  it("cuts long texts on a word boundary", () => {
    const text = "Tournoi de football inter-promos avec buvette, musique et remise des prix.";
    expect(excerpt(text, 40)).toBe("Tournoi de football inter-promos avec…");
  });
});
