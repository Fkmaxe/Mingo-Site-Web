import { z } from "zod";

export const CUSTOM_FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "select",
  "multiselect",
  "checkbox",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** Types answered by picking among `options`: one (`select`, radio buttons) or several. */
export const CHOICE_FIELD_TYPES = ["select", "multiselect"] as const;
export const isChoiceField = (type: CustomFieldType) =>
  (CHOICE_FIELD_TYPES as readonly string[]).includes(type);

export const MAX_CUSTOM_FIELDS = 10;

export const CustomFieldDef = z
  .object({
    /** Stable key of the answer, derived from the label when created. */
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé de champ invalide"),
    label: z.string().trim().min(1, "Le libellé est obligatoire").max(200, "Libellé trop long"),
    /** Text shown under the label, on several lines ("- Discord : @pseudo"…). */
    description: z.string().trim().max(1000, "Explication trop longue").optional(),
    type: z.enum(CUSTOM_FIELD_TYPES, "Type de champ invalide"),
    required: z.boolean(),
    /** Choices of a `select` or `multiselect` field. */
    options: z
      .array(z.string().trim().min(1, "Choix vide").max(60, "Choix trop long"))
      .max(30, "30 choix maximum")
      .optional(),
    /** Choice fields: an "Autre" choice with a free text answer. */
    allowOther: z.boolean().optional(),
  })
  .superRefine((field, ctx) => {
    const choices = (field.options?.length ?? 0) + (field.allowOther ? 1 : 0);
    if (isChoiceField(field.type) && choices < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Indique au moins 2 choix" });
    }
  })
  .meta({ id: "CustomField" });
export type CustomFieldDef = z.infer<typeof CustomFieldDef>;

export const CustomFieldsSchema = z
  .array(CustomFieldDef)
  .max(MAX_CUSTOM_FIELDS, `${MAX_CUSTOM_FIELDS} champs maximum`)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "label"],
          message: "Deux champs portent le même nom",
        });
      }
      seen.add(field.key);
    });
  });

export type AnswerValue = string | number | boolean | string[];
export type Answers = Record<string, AnswerValue>;

/** Turns a label into an answer key: "Taille de t-shirt" -> "taille_de_t_shirt". */
export function fieldKey(label: string): string {
  const key = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return /^[a-z]/.test(key) ? key : `champ_${key}`.slice(0, 40);
}

export const OTHER_ANSWER_MAX = 100;

/** A listed choice, or (with `allowOther`) the free text typed after "Autre". */
function choiceSchema(field: CustomFieldDef): z.ZodType<string> {
  const options = field.options ?? [];
  const listed = z.string().refine((v) => options.includes(v), "Choix invalide");
  if (!field.allowOther) return listed;
  return z
    .string()
    .trim()
    .min(1, "Précise ta réponse")
    .max(OTHER_ANSWER_MAX, `Réponse trop longue (${OTHER_ANSWER_MAX} caractères max)`);
}

function answerSchema(field: CustomFieldDef): z.ZodType {
  switch (field.type) {
    case "text":
    case "longtext": {
      const max = field.type === "text" ? 300 : 2000;
      const text = z.string().trim().max(max, `Réponse trop longue (${max} caractères max)`);
      return field.required ? text.min(1, "Ce champ est obligatoire") : text.optional();
    }
    case "number": {
      const number = z.number("Indique un nombre");
      return field.required ? number : number.optional();
    }
    case "select": {
      const choice = choiceSchema(field);
      return field.required ? choice : choice.optional();
    }
    case "multiselect": {
      const max = (field.options?.length ?? 0) + (field.allowOther ? 1 : 0);
      const choices = z
        .array(choiceSchema(field), "Choix invalide")
        .max(max, "Choix invalide")
        .refine((list) => new Set(list).size === list.length, "Choix en double");
      return field.required
        ? choices.refine((list) => list.length > 0, "Coche au moins un choix")
        : choices.optional();
    }
    case "checkbox":
      return field.required
        ? z.literal(true, "Cette case doit être cochée")
        : z.boolean().optional();
  }
}

/** Zod schema validating a registration's answers against the event's fields. */
export function answersSchema(fields: CustomFieldDef[]) {
  return z.object(Object.fromEntries(fields.map((f) => [f.key, answerSchema(f)])));
}

/** Readable value for lists and exports. */
export function formatAnswer(value: AnswerValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
