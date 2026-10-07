import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Soirée d'intégration 2026 !", "soiree-d-integration-2026"],
    ["  Tournoi   FIFA  ", "tournoi-fifa"],
    ["???", "evenement"],
  ])("%s -> %s", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("caps the length", () => {
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("uniqueSlug", () => {
  it("keeps a free slug and suffixes a taken one", async () => {
    expect(await uniqueSlug("gala", async () => false)).toBe("gala");
    const taken = new Set(["gala"]);
    expect(await uniqueSlug("gala", async (s) => taken.has(s))).toMatch(/^gala-[0-9a-f]{4}$/);
  });
});
