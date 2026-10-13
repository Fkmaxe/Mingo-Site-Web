import { describe, expect, it } from "vitest";
import { resolveClass } from "./rules";

const firstYear = { name: "1A", alternanceOnly: false, trackIds: ["tronc", "mcsi"] };
const thirdYear = { name: "3A", alternanceOnly: true, trackIds: ["mcsi", "secu", "reseaux"] };

describe("resolveClass", () => {
  it("keeps the chosen rhythm where students choose", () => {
    expect(resolveClass(firstYear, "tronc", "initial")).toEqual({ ok: true, rhythm: "initial" });
    expect(resolveClass(firstYear, "mcsi", "alternance")).toEqual({
      ok: true,
      rhythm: "alternance",
    });
    expect(resolveClass(firstYear, null, null)).toEqual({ ok: true, rhythm: null });
  });

  it("forces work-study in an alternance-only year", () => {
    expect(resolveClass(thirdYear, "secu", "initial")).toEqual({ ok: true, rhythm: "alternance" });
    expect(resolveClass(thirdYear, null, null)).toEqual({ ok: true, rhythm: "alternance" });
  });

  it("refuses a programme not offered that year", () => {
    expect(resolveClass(firstYear, "secu", "initial")).toEqual({
      ok: false,
      message: "Cette filière n'est pas proposée en 1A.",
    });
    expect(resolveClass(thirdYear, "tronc", null).ok).toBe(false);
  });

  it("accepts any programme in a year without a list, or without a year", () => {
    expect(resolveClass({ name: "B1", alternanceOnly: false, trackIds: [] }, "secu", null).ok).toBe(
      true,
    );
    expect(resolveClass(null, "secu", "initial")).toEqual({ ok: true, rhythm: "initial" });
  });
});
