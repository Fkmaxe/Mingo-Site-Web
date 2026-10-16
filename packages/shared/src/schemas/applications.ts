import { z } from "zod";
import { APPLICATION_STATUSES } from "../enums";
import { CustomFieldDef, customFieldsSchema } from "./custom-fields";
import { DOCUMENT_FILE_TYPES } from "./documents";

export const APPLICATION_MAX_QUESTIONS = 20;
export const APPLICATION_MAX_DOCUMENTS = 10;
export const APPLICATION_MAX_WISHES = 3;

/** The question of every form until the bureau changes it. */
export const DEFAULT_APPLICATION_FIELDS: CustomFieldDef[] = [
  {
    key: "motivation",
    label: "Pourquoi veux-tu rejoindre le BDE ?",
    description: "Ce que tu aimerais faire, tes disponibilités…",
    type: "longtext",
    required: true,
  },
];

/** A document the candidate hands in (CV, cover letter, portfolio…). */
export const DocumentRequirementDef = z
  .object({
    /** Stable key of the document, derived from the label when created. */
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Clé de document invalide"),
    label: z.string().trim().min(1, "Le nom du document est obligatoire").max(120, "Nom trop long"),
    description: z.string().trim().max(1000, "Explication trop longue").optional(),
    required: z.boolean(),
    /** Only a PDF is accepted (otherwise photos, office documents, text, CSV). */
    pdfOnly: z.boolean(),
    /** A link (Drive, portfolio…) may be given instead of a file. */
    allowLink: z.boolean(),
  })
  .meta({ id: "DocumentRequirement" });
export type DocumentRequirementDef = z.infer<typeof DocumentRequirementDef>;

export const DocumentRequirementsSchema = z
  .array(DocumentRequirementDef)
  .max(APPLICATION_MAX_DOCUMENTS, `${APPLICATION_MAX_DOCUMENTS} documents maximum`)
  .superRefine((docs, ctx) => {
    const seen = new Set<string>();
    docs.forEach((doc, index) => {
      if (seen.has(doc.key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "label"],
          message: "Deux documents portent le même nom",
        });
      }
      seen.add(doc.key);
    });
  });

const Pole = z.object({ id: z.uuid(), name: z.string() });

/** The application form of the school year, set by the bureau. */
export const ApplicationFormDto = z
  .object({
    isOpen: z.boolean(),
    /** Applications close by themselves at that time. */
    closesAt: z.iso.datetime().nullable(),
    /** Open and before the deadline: candidates can apply now. */
    acceptingNow: z.boolean(),
    intro: z.string(),
    /** How many poles a candidate ranks (1 to 3). */
    maxWishes: z.int().min(1).max(APPLICATION_MAX_WISHES),
    /** Every pole recruits; otherwise only `recruitingPoles`. */
    allPolesRecruiting: z.boolean(),
    /** The poles offered to candidates (all of them when `allPolesRecruiting`). */
    recruitingPoles: z.array(Pole),
    fields: z.array(CustomFieldDef),
    documents: z.array(DocumentRequirementDef),
  })
  .meta({ id: "ApplicationForm" });
export type ApplicationFormDto = z.infer<typeof ApplicationFormDto>;

export const UpdateApplicationFormInput = z
  .object({
    isOpen: z.boolean(),
    closesAt: z.iso.datetime({ offset: true, message: "Date invalide" }).nullable(),
    intro: z.string().trim().max(3000, "Texte trop long"),
    maxWishes: z.int().min(1, "1 vœu minimum").max(APPLICATION_MAX_WISHES, "3 vœux maximum"),
    allPolesRecruiting: z.boolean(),
    recruitingPoleIds: z.array(z.uuid("Pôle invalide")).max(50),
    fields: customFieldsSchema(APPLICATION_MAX_QUESTIONS),
    documents: DocumentRequirementsSchema,
  })
  .refine((v) => v.allPolesRecruiting || v.recruitingPoleIds.length > 0, {
    path: ["recruitingPoleIds"],
    message: "Choisis au moins un pôle qui recrute",
  })
  .meta({ id: "UpdateApplicationFormInput" });
export type UpdateApplicationFormInput = z.infer<typeof UpdateApplicationFormInput>;

export const CreateApplicationInput = z
  .object({
    /** Poles ranked by preference, the first one first. */
    wishedPoleIds: z
      .array(z.uuid("Choisis un pôle"))
      .min(1, "Choisis un pôle")
      .max(APPLICATION_MAX_WISHES, `${APPLICATION_MAX_WISHES} vœux maximum`)
      .refine((ids) => new Set(ids).size === ids.length, "Choisis des pôles différents"),
    /** Checked against the questions of the form by the API. */
    answers: z.record(z.string(), z.unknown()).default({}),
  })
  .meta({ id: "CreateApplicationInput" });
export type CreateApplicationInput = z.input<typeof CreateApplicationInput>;
export type CreateApplicationData = z.output<typeof CreateApplicationInput>;

export const ApplicationLinkInput = z
  .object({
    url: z
      .url({ protocol: /^https?$/, message: "Lien invalide (https://…)" })
      .max(500, "Lien trop long"),
  })
  .meta({ id: "ApplicationLinkInput" });

export const ApplicationFileQuery = z.object({
  /** Original file name, shown to the reviewers. */
  name: z.string().trim().min(1).max(200),
});

export const ApplicationDocumentDto = z
  .object({
    key: z.string(),
    kind: z.enum(["file", "link"]),
    /** File name, or the link itself. */
    name: z.string(),
    /** Web path of a file (relayed by the web), or the link. */
    url: z.string(),
    contentType: z.enum(DOCUMENT_FILE_TYPES).nullable(),
    sizeBytes: z.int().nullable(),
  })
  .meta({ id: "ApplicationDocument" });

const AnswerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const ApplicationShape = z.object({
  id: z.uuid(),
  status: z.enum(APPLICATION_STATUSES),
  /** Ranked wishes, the first one first. */
  wishes: z.array(Pole),
  /** The questions as they were when the candidate applied. */
  questions: z.array(CustomFieldDef),
  answers: z.record(z.string(), AnswerValue),
  /** The documents asked when the candidate applied. */
  documentRequirements: z.array(DocumentRequirementDef),
  documents: z.array(ApplicationDocumentDto),
  /** Labels of the required documents not handed in yet. */
  missingDocuments: z.array(z.string()),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    promo: z.string().nullable(),
  }),
  createdAt: z.iso.datetime(),
});

export const ApplicationDto = ApplicationShape.meta({ id: "Application" });
export type ApplicationDto = z.infer<typeof ApplicationDto>;

/** Inline (not a $ref): a nullable reference is generated as an unusable allOf type. */
export const MyApplicationDto = ApplicationShape.nullable();

export const ListApplicationsQuery = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
});

export const DecideApplicationInput = z
  .object({ status: z.enum(["interview", "rejected"]) })
  .meta({ id: "DecideApplicationInput" });

export const AcceptApplicationInput = z
  .object({
    /** Defaults to the first wish. */
    poleId: z.uuid().optional(),
  })
  .meta({ id: "AcceptApplicationInput" });
