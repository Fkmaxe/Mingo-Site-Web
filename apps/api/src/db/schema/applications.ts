import {
  type Answers,
  APPLICATION_STATUSES,
  type CustomFieldDef,
  DEFAULT_APPLICATION_FIELDS,
  type DocumentRequirementDef,
} from "@bde/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { pole, schoolYear } from "./organization";

export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);

/** The application form of a school year, set by the bureau (defaults until then). */
export const applicationForm = pgTable(
  "application_form",
  {
    id: id(),
    schoolYearId: uuid()
      .notNull()
      .unique("application_form_school_year_unique")
      .references(() => schoolYear.id, { onDelete: "cascade" }),
    isOpen: boolean().notNull().default(true),
    closesAt: timestamp({ withTimezone: true }),
    intro: text().notNull().default(""),
    maxWishes: integer().notNull().default(1),
    /** Every pole recruits; otherwise only those of `application_form_pole`. */
    allPolesRecruiting: boolean().notNull().default(true),
    fields: jsonb().$type<CustomFieldDef[]>().notNull().default(DEFAULT_APPLICATION_FIELDS),
    documents: jsonb().$type<DocumentRequirementDef[]>().notNull().default([]),
    updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("application_form_updated_by_idx").on(t.updatedBy),
    check("application_form_max_wishes_check", sql`${t.maxWishes} between 1 and 3`),
  ],
);

/** Poles offered to candidates when not every pole recruits. */
export const applicationFormPole = pgTable(
  "application_form_pole",
  {
    id: id(),
    formId: uuid()
      .notNull()
      .references(() => applicationForm.id, { onDelete: "cascade" }),
    poleId: uuid()
      .notNull()
      .references(() => pole.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("application_form_pole_unique").on(t.formId, t.poleId),
    index("application_form_pole_pole_id_idx").on(t.poleId),
  ],
);

export const application = pgTable(
  "application",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    schoolYearId: uuid()
      .notNull()
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    /** The questions and documents of the form when the candidate applied. */
    questions: jsonb().$type<CustomFieldDef[]>().notNull(),
    answers: jsonb().$type<Answers>().notNull(),
    documentRequirements: jsonb().$type<DocumentRequirementDef[]>().notNull().default([]),
    status: applicationStatus().notNull().default("new"),
    decidedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("application_user_year_unique").on(t.userId, t.schoolYearId),
    index("application_school_year_status_idx").on(t.schoolYearId, t.status),
    index("application_decided_by_idx").on(t.decidedBy),
  ],
);

/** The poles a candidate wishes for, ranked (1 = first choice). */
export const applicationWish = pgTable(
  "application_wish",
  {
    id: id(),
    applicationId: uuid()
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    poleId: uuid()
      .notNull()
      .references(() => pole.id, { onDelete: "restrict" }),
    rank: integer().notNull(),
  },
  (t) => [
    unique("application_wish_rank_unique").on(t.applicationId, t.rank),
    unique("application_wish_pole_unique").on(t.applicationId, t.poleId),
    index("application_wish_pole_id_idx").on(t.poleId),
  ],
);

/** A document handed in: a file of the documents store, or a link. One per asked document. */
export const applicationDocument = pgTable(
  "application_document",
  {
    id: id(),
    applicationId: uuid()
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    requirementKey: text().notNull(),
    /** Name in the documents store (random, never reused); null for a link. */
    fileName: text().unique("application_document_file_name_unique"),
    originalName: text(),
    contentType: text(),
    sizeBytes: integer(),
    linkUrl: text(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("application_document_requirement_unique").on(t.applicationId, t.requirementKey),
    check(
      "application_document_file_or_link_check",
      sql`(${t.fileName} is null) <> (${t.linkUrl} is null)`,
    ),
  ],
);
