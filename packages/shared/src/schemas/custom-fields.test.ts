import { describe, expect, it } from "vitest";
import { answersSchema, CustomFieldsSchema, fieldKey, formatAnswer } from "./custom-fields";

const fields = CustomFieldsSchema.parse([
  {
    key: "taille",
    label: "Taille de t-shirt",
    type: "select",
    required: true,
    options: ["S", "M", "L"],
  },
  { key: "regime", label: "Régime alimentaire", type: "text", required: false },
  { key: "age", label: "Âge", type: "number", required: false },
  { key: "reglement", label: "J'accepte le règlement", type: "checkbox", required: true },
]);

describe("custom fields definition", () => {
  it("derives keys from labels", () => {
    expect(fieldKey("Taille de t-shirt")).toBe("taille_de_t_shirt");
    expect(fieldKey("Régime alimentaire")).toBe("regime_alimentaire");
    expect(fieldKey("2e choix")).toBe("champ_2e_choix");
  });

  it("requires choices for a select and unique keys", () => {
    expect(
      CustomFieldsSchema.safeParse([
        { key: "a", label: "A", type: "select", required: false, options: ["x"] },
      ]).error?.issues[0]?.message,
    ).toBe("Indique au moins 2 choix");
    const twice = { key: "a", label: "A", type: "text", required: false };
    expect(CustomFieldsSchema.safeParse([twice, twice]).error?.issues[0]?.message).toBe(
      "Deux champs portent le même nom",
    );
  });
});

describe("answersSchema", () => {
  const schema = answersSchema(fields);

  it("accepts valid answers and drops unknown keys", () => {
    expect(schema.parse({ taille: "M", reglement: true, age: 20, hack: "x" })).toEqual({
      taille: "M",
      reglement: true,
      age: 20,
    });
  });

  it("explains missing or invalid answers in French", () => {
    const issues = schema.safeParse({ taille: "XXL", regime: "x".repeat(301) }).error?.issues ?? [];
    expect(Object.fromEntries(issues.map((i) => [i.path[0], i.message]))).toEqual({
      taille: "Choix invalide",
      regime: "Réponse trop longue (300 caractères max)",
      reglement: "Cette case doit être cochée",
    });
  });

  it("formats answers", () => {
    expect([
      formatAnswer(true),
      formatAnswer(false),
      formatAnswer(3),
      formatAnswer(undefined),
    ]).toEqual(["Oui", "Non", "3", ""]);
  });
});
