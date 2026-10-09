import { itemCode, parseItemCode } from "@bde/shared";
import { describe, expect, it } from "vitest";
import { adjustedQuantity, available, changesOf, checkoutRefusal, isOverdue } from "./rules";

describe("label codes", () => {
  it("formats and reads INV-0042", () => {
    expect(itemCode(42)).toBe("INV-0042");
    expect(itemCode(12345)).toBe("INV-12345");
    for (const text of ["INV-0042", "inv42", " 42 ", "inv-42"])
      expect(parseItemCode(text)).toBe(42);
    expect(parseItemCode("enceinte")).toBeNull();
  });
});

describe("taking things out", () => {
  it("allows a unique item once at a time", () => {
    expect(checkoutRefusal({ kind: "unique", quantity: 1 }, 0, 1)).toBeNull();
    expect(checkoutRefusal({ kind: "unique", quantity: 1 }, 1, 1)).toMatch(/déjà sorti/);
    expect(checkoutRefusal({ kind: "unique", quantity: 1 }, 0, 2)).toMatch(/un seul/);
  });

  it("limits a stock to what is left", () => {
    expect(available(50, 20)).toBe(30);
    expect(checkoutRefusal({ kind: "stock", quantity: 50 }, 20, 30)).toBeNull();
    expect(checkoutRefusal({ kind: "stock", quantity: 50 }, 20, 31)).toBe(
      "Seulement 30 disponibles.",
    );
    expect(checkoutRefusal({ kind: "stock", quantity: 50 }, 50, 1)).toMatch(/tout est sorti/);
  });
});

describe("adjusting a stock", () => {
  it("never goes below zero nor below what is out", () => {
    expect(adjustedQuantity(10, 0, 5)).toEqual({ quantity: 15 });
    expect(adjustedQuantity(10, 0, -11)).toHaveProperty("refusal");
    expect(adjustedQuantity(10, 8, -3)).toEqual({
      refusal: "8 sont sortis : la quantité ne peut pas descendre en dessous.",
    });
  });
});

describe("history of an edit", () => {
  const before = {
    name: "Enceinte",
    description: "",
    category: "Son",
    condition: "good" as const,
    locationId: "local",
    poleId: null,
  };

  it("separates a move and a state change from other fields", () => {
    expect(
      changesOf(before, { locationId: "cave", condition: "worn", name: "Enceinte JBL" }),
    ).toEqual({
      moved: { from: "local", to: "cave" },
      condition: { from: "good", to: "worn" },
      fields: { name: { from: "Enceinte", to: "Enceinte JBL" } },
    });
  });

  it("records nothing when nothing changes", () => {
    expect(changesOf(before, { name: "Enceinte", locationId: "local" })).toEqual({
      moved: null,
      condition: null,
      fields: {},
    });
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("is overdue after the due date only", () => {
    expect(isOverdue(new Date("2026-10-10T11:00:00Z"), now)).toBe(true);
    expect(isOverdue(new Date("2026-10-11T11:00:00Z"), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
  });
});
