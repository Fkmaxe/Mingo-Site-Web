import { describe, expect, it } from "vitest";
import { describeMovement } from "./labels";

describe("describeMovement", () => {
  it("says what happened in a few words", () => {
    expect(describeMovement("moved", { from: "Local BDE", to: "Cave" })).toBe("Local BDE → Cave");
    expect(describeMovement("condition_changed", { from: "good", to: "broken" })).toBe(
      "Bon état → HS",
    );
    expect(describeMovement("quantity_adjusted", { delta: -3, from: 50, to: 47 })).toBe(
      "-3 (50 → 47)",
    );
    expect(describeMovement("checked_out", { quantity: 20, holder: "Bar", event: "Gala" })).toBe(
      "20 × chez Bar pour Gala",
    );
    expect(describeMovement("returned", { holder: "Léa", condition: "worn" })).toBe("par Léa, usé");
    expect(describeMovement("updated", { name: {}, category: {} })).toBe("nom, catégorie");
  });
});
