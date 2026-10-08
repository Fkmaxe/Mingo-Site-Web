import { describe, expect, it } from "vitest";
import { formatCents, parseEuros } from "./money";

describe("money", () => {
  it("formats cents in French euros", () => {
    expect(formatCents(123456).replace(/\s/g, " ")).toBe("1 234,56 €");
    expect(formatCents(-4550).replace(/\s/g, " ")).toBe("-45,50 €");
  });

  it("parses typed amounts to cents", () => {
    expect(parseEuros("12,5")).toBe(1250);
    expect(parseEuros("1 200")).toBe(120000);
    expect(parseEuros("0.07 €")).toBe(7);
    expect(parseEuros("12,345")).toBeNull();
    expect(parseEuros("-3")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
  });
});
