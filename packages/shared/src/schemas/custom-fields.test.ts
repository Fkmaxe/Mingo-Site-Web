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

describe("richer questions (BDE tournament form)", () => {
  const form = CustomFieldsSchema.parse([
    {
      key: "contact",
      label: "Indique ton moyen de contact et ton identifiant.",
      description: "Au moins un :\n- Discord : @pseudo\n- Email : prenom.nom@mail.com",
      type: "longtext",
      required: true,
    },
    {
      key: "attestation",
      label: "J'atteste ma présence à ce tournoi en tant que participant.",
      description: "- Je serai sur place à 16h30 dernier délai.\n- Je préviens en cas de retard.",
      type: "select",
      required: true,
      options: ["Oui", "Non"],
    },
    {
      key: "source",
      label: "Comment as-tu eu connaissance de l'événement ?",
      type: "select",
      required: true,
      options: ["Discord", "Flyers", "Instagram"],
      allowOther: true,
    },
    {
      key: "jeux",
      label: "Jeux joués",
      type: "multiselect",
      required: true,
      options: ["Tekken", "Smash"],
      allowOther: true,
    },
  ]);
  const schema = answersSchema(form);
  const valid = {
    contact: "Discord : @mingo\nEmail : a@b.fr",
    attestation: "Oui",
    source: "Discord",
    jeux: ["Tekken"],
  };

  it("keeps the multi-line explanation", () => {
    expect(form[0]?.description).toContain("\n- Discord");
  });

  it("accepts listed choices, an 'Autre' free text and several choices", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    const other = schema.safeParse({ ...valid, source: " Un ami ", jeux: ["Smash", "Street"] });
    expect(other.success && other.data).toMatchObject({
      source: "Un ami",
      jeux: ["Smash", "Street"],
    });
  });

  it("refuses an unlisted choice without 'Autre', duplicates and empty required lists", () => {
    expect(schema.safeParse({ ...valid, attestation: "Peut-être" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, jeux: [] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, jeux: ["Smash", "Smash"] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, contact: "" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, source: "x".repeat(101) }).success).toBe(false);
  });

  it("needs two choices, 'Autre' counting as one", () => {
    const base = { key: "q", label: "Q", type: "multiselect", required: false };
    expect(CustomFieldsSchema.safeParse([{ ...base, options: ["A"] }]).success).toBe(false);
    expect(
      CustomFieldsSchema.safeParse([{ ...base, options: ["A"], allowOther: true }]).success,
    ).toBe(true);
  });

  it("formats several choices on one line", () => {
    expect(formatAnswer(["Smash", "Street"])).toBe("Smash, Street");
  });
});
