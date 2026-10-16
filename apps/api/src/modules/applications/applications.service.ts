import {
  type Answers,
  type ApplicationDto,
  type ApplicationFormDto,
  type ApplicationStatus,
  answersSchema,
  type CreateApplicationData,
  DEFAULT_APPLICATION_FIELDS,
  DOCUMENT_FILE_MAX_BYTES,
  type DocumentFileType,
  type UpdateApplicationFormInput,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { assertPoleAccess } from "../../core/permissions";
import { inTransaction, inTransactionWithEffects } from "../../core/tx";
import { type DocumentStore, sniffDocumentType } from "../../lib/storage";
import { getPole, listPoles } from "../poles";
import { requireCurrentSchoolYear } from "../school-years";
import { acceptedEmail, rejectedEmail } from "./applications.emails";
import {
  type ApplicationRow,
  deleteApplication,
  deleteDocument,
  findActiveMembership,
  findApplication,
  findApplications,
  findDocument,
  findDocumentByFileName,
  findDocuments,
  findForm,
  findFormPoles,
  findUserApplication,
  findWishes,
  insertApplication,
  insertMembership,
  insertWishes,
  saveForm,
  setStatus,
  upsertDocument,
} from "./applications.repo";

const notFound = () => new AppError("NOT_FOUND", 404, "Cette candidature n'existe pas.");
const forbidden = () => new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");
const invalid = (path: string, message: string) =>
  new AppError("VALIDATION_ERROR", 400, message, { issues: [{ path: [path], message }] });

/** Path on the web origin (the web relays the files: the browser never calls the API). */
export const applicationFilePath = (fileName: string) => `/applications/files/${fileName}`;

// --- Form ---

/** The year's form, or the defaults until the bureau saves one. */
async function loadForm(ctx: AuthedCtx, schoolYearId: string, now: Date) {
  const row = await findForm(ctx.db, schoolYearId);
  const allPolesRecruiting = row?.allPolesRecruiting ?? true;
  const recruitingPoles =
    allPolesRecruiting || !row
      ? (await listPoles(ctx)).map((p) => ({ id: p.id, name: p.name }))
      : await findFormPoles(ctx.db, row.id);
  const isOpen = row?.isOpen ?? true;
  const closesAt = row?.closesAt ?? null;
  const form: ApplicationFormDto = {
    isOpen,
    closesAt: closesAt?.toISOString() ?? null,
    acceptingNow: isOpen && (closesAt === null || now < closesAt),
    intro: row?.intro ?? "",
    maxWishes: row?.maxWishes ?? 1,
    allPolesRecruiting,
    recruitingPoles,
    fields: row?.fields ?? DEFAULT_APPLICATION_FIELDS,
    documents: row?.documents ?? [],
  };
  return form;
}

export async function getForm(ctx: AuthedCtx, now: Date = new Date()) {
  const year = await requireCurrentSchoolYear(ctx);
  return loadForm(ctx, year.id, now);
}

/** The bureau sets the form of the year: opening, poles, questions, documents. */
export async function updateForm(
  ctx: AuthedCtx,
  input: UpdateApplicationFormInput,
  now: Date = new Date(),
) {
  if (!ctx.permissions.has("poles:all")) throw forbidden();
  const year = await requireCurrentSchoolYear(ctx);
  const poleIds = input.allPolesRecruiting ? [] : [...new Set(input.recruitingPoleIds)];
  for (const poleId of poleIds) await getPole(ctx, poleId);
  await inTransaction(ctx.db, async (tx) => {
    await saveForm(
      tx,
      year.id,
      {
        isOpen: input.isOpen,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        intro: input.intro,
        maxWishes: input.maxWishes,
        allPolesRecruiting: input.allPolesRecruiting,
        fields: input.fields,
        documents: input.documents,
        updatedBy: ctx.user.id,
      },
      poleIds,
    );
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "application_form.updated",
      entity: "application_form",
      entityId: year.id,
      payload: {
        isOpen: input.isOpen,
        closesAt: input.closesAt,
        maxWishes: input.maxWishes,
        recruitingPoleIds: input.allPolesRecruiting ? "all" : poleIds,
        questions: input.fields.map((f) => f.label),
        documents: input.documents.map((d) => d.label),
      },
    });
  });
  return loadForm(ctx, year.id, now);
}

// --- Applications ---

async function toDtos(ctx: AuthedCtx, rows: ApplicationRow[]): Promise<ApplicationDto[]> {
  const ids = rows.map((r) => r.application.id);
  const [wishes, documents] = await Promise.all([
    findWishes(ctx.db, ids),
    findDocuments(ctx.db, ids),
  ]);
  return rows.map(({ application: a, user }) => {
    const docs = documents.get(a.id) ?? [];
    const handedIn = new Set(docs.map((d) => d.requirementKey));
    return {
      id: a.id,
      status: a.status,
      wishes: wishes.get(a.id) ?? [],
      questions: a.questions,
      answers: a.answers,
      documentRequirements: a.documentRequirements,
      documents: docs.map((d) =>
        d.fileName
          ? {
              key: d.requirementKey,
              kind: "file" as const,
              name: d.originalName ?? "document",
              url: applicationFilePath(d.fileName),
              contentType: d.contentType as DocumentFileType,
              sizeBytes: d.sizeBytes,
            }
          : {
              key: d.requirementKey,
              kind: "link" as const,
              name: d.linkUrl ?? "",
              url: d.linkUrl ?? "",
              contentType: null,
              sizeBytes: null,
            },
      ),
      missingDocuments: a.documentRequirements
        .filter((r) => r.required && !handedIn.has(r.key))
        .map((r) => r.label),
      user,
      createdAt: a.createdAt.toISOString(),
    };
  });
}

async function toDto(ctx: AuthedCtx, row: ApplicationRow) {
  const [dto] = await toDtos(ctx, [row]);
  if (!dto) throw notFound();
  return dto;
}

/** Validates the answers against the form's questions (400 with the issues otherwise). */
function parseAnswers(form: ApplicationFormDto, answers: Record<string, unknown>): Answers {
  const parsed = answersSchema(form.fields).safeParse(answers);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", 400, "Certaines réponses sont invalides.", {
      issues: parsed.error.issues.map((i) => ({ ...i, path: ["answers", ...i.path] })),
    });
  }
  // The schema built from the fields only admits strings, numbers, booleans and lists.
  return parsed.data as Answers;
}

export async function apply(ctx: AuthedCtx, input: CreateApplicationData, now: Date = new Date()) {
  const year = await requireCurrentSchoolYear(ctx);
  if (ctx.roles.includes("member")) {
    throw new AppError("ALREADY_MEMBER", 409, "Tu fais déjà partie du BDE cette année.");
  }
  if (await findUserApplication(ctx.db, ctx.user.id, year.id)) {
    throw new AppError("ALREADY_APPLIED", 409, "Tu as déjà candidaté cette année.");
  }
  const form = await loadForm(ctx, year.id, now);
  if (!form.acceptingNow) {
    throw new AppError("APPLICATIONS_CLOSED", 409, "Les candidatures sont fermées.");
  }
  if (input.wishedPoleIds.length > form.maxWishes) {
    throw invalid(
      "wishedPoleIds",
      form.maxWishes === 1 ? "Choisis un seul pôle." : `${form.maxWishes} pôles au plus.`,
    );
  }
  const recruiting = new Set(form.recruitingPoles.map((p) => p.id));
  if (!input.wishedPoleIds.every((id) => recruiting.has(id))) {
    throw invalid("wishedPoleIds", "Un de ces pôles ne recrute pas.");
  }
  const answers = parseAnswers(form, input.answers);
  const id = await inTransaction(ctx.db, async (tx) => {
    const applicationId = await insertApplication(tx, {
      userId: ctx.user.id,
      schoolYearId: year.id,
      questions: form.fields,
      answers,
      documentRequirements: form.documents,
    });
    await insertWishes(tx, applicationId, input.wishedPoleIds);
    return applicationId;
  });
  const row = await findApplication(ctx.db, id);
  if (!row) throw notFound();
  return toDto(ctx, row);
}

async function myApplication(ctx: AuthedCtx) {
  const year = await requireCurrentSchoolYear(ctx);
  return findUserApplication(ctx.db, ctx.user.id, year.id);
}

export async function getMyApplication(ctx: AuthedCtx): Promise<ApplicationDto | null> {
  const row = await myApplication(ctx);
  return row ? toDto(ctx, row) : null;
}

/** Withdrawn before review: the application and its files go. */
export async function withdraw(ctx: AuthedCtx, files: DocumentStore) {
  const row = await myApplication(ctx);
  if (!row) throw notFound();
  if (row.application.status !== "new") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      "Ta candidature est déjà en cours d'examen : contacte le bureau.",
    );
  }
  const documents = (await findDocuments(ctx.db, [row.application.id])).get(row.application.id);
  await deleteApplication(ctx.db, row.application.id);
  for (const d of documents ?? []) if (d.fileName) await files.remove(d.fileName);
}

// --- Documents handed in by the candidate ---

/** My application, still open, and the asked document `key`. */
async function openRequirement(ctx: AuthedCtx, key: string) {
  const row = await myApplication(ctx);
  if (!row) throw notFound();
  if (row.application.status === "accepted" || row.application.status === "rejected") {
    throw new AppError("INVALID_STATUS_TRANSITION", 409, "Ta candidature est déjà tranchée.");
  }
  const requirement = row.application.documentRequirements.find((r) => r.key === key);
  if (!requirement) throw new AppError("NOT_FOUND", 404, "Ce document n'est pas demandé.");
  return { row, requirement };
}

/** Hands in a file for an asked document (replacing the previous one), recognised by its bytes. */
export async function handInFile(
  ctx: AuthedCtx,
  files: DocumentStore,
  key: string,
  file: { name: string; declaredType: string; bytes: Uint8Array },
) {
  const { row, requirement } = await openRequirement(ctx, key);
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > DOCUMENT_FILE_MAX_BYTES) {
    throw new AppError("VALIDATION_ERROR", 400, "Un document doit faire moins de 10 Mo.");
  }
  const type = sniffDocumentType(file.bytes, file.declaredType);
  if (!type || (requirement.pdfOnly && type !== "application/pdf")) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      requirement.pdfOnly
        ? `« ${requirement.label} » : envoie un PDF.`
        : "Envoie une photo, un PDF, un document Word, Excel ou PowerPoint, un texte ou un CSV.",
    );
  }
  const previous = await findDocument(ctx.db, row.application.id, key);
  const fileName = await files.save(file.bytes, type);
  try {
    await upsertDocument(ctx.db, {
      applicationId: row.application.id,
      requirementKey: key,
      fileName,
      originalName: file.name,
      contentType: type,
      sizeBytes: file.bytes.byteLength,
      linkUrl: null,
    });
  } catch (error) {
    await files.remove(fileName);
    throw error;
  }
  if (previous?.fileName) await files.remove(previous.fileName);
  return toDto(ctx, row);
}

/** Hands in a link (Drive, portfolio…) where the document allows one. */
export async function handInLink(ctx: AuthedCtx, files: DocumentStore, key: string, url: string) {
  const { row, requirement } = await openRequirement(ctx, key);
  if (!requirement.allowLink) {
    throw invalid("url", `« ${requirement.label} » : envoie un fichier, pas un lien.`);
  }
  const previous = await findDocument(ctx.db, row.application.id, key);
  await upsertDocument(ctx.db, {
    applicationId: row.application.id,
    requirementKey: key,
    fileName: null,
    originalName: null,
    contentType: null,
    sizeBytes: null,
    linkUrl: url,
  });
  if (previous?.fileName) await files.remove(previous.fileName);
  return toDto(ctx, row);
}

export async function removeDocument(ctx: AuthedCtx, files: DocumentStore, key: string) {
  const { row } = await openRequirement(ctx, key);
  const document = await findDocument(ctx.db, row.application.id, key);
  if (!document) throw new AppError("NOT_FOUND", 404, "Ce document n'a pas été remis.");
  await deleteDocument(ctx.db, document.id);
  if (document.fileName) await files.remove(document.fileName);
  return toDto(ctx, row);
}

// --- Review ---

/** The board, or the lead of a pole the candidate wishes for. */
function canReview(ctx: AuthedCtx, wishedPoleIds: string[]) {
  if (!ctx.permissions.has("members:manage")) return false;
  if (ctx.permissions.has("poles:all")) return true;
  return ctx.memberships.some(
    (m) => m.role === "pole_lead" && m.poleId !== null && wishedPoleIds.includes(m.poleId),
  );
}

/** The candidate or a reviewer reads a handed-in file. */
export async function readDocument(ctx: AuthedCtx, files: DocumentStore, fileName: string) {
  const document = await findDocumentByFileName(ctx.db, fileName);
  const row = document ? await findApplication(ctx.db, document.applicationId) : undefined;
  if (!document?.fileName || !row)
    throw new AppError("NOT_FOUND", 404, "Ce document n'existe pas.");
  const wishes = (await findWishes(ctx.db, [row.application.id])).get(row.application.id) ?? [];
  const own = row.application.userId === ctx.user.id;
  if (
    !own &&
    !canReview(
      ctx,
      wishes.map((w) => w.id),
    )
  ) {
    throw new AppError("NOT_FOUND", 404, "Ce document n'existe pas.");
  }
  const file = await files.read(document.fileName);
  if (!file) throw new AppError("NOT_FOUND", 404, "Ce document n'existe pas.");
  return { ...file, name: document.originalName ?? "document" };
}

/** Board: every application; pole leads: those wishing for their pole, at any rank. */
export async function listApplications(ctx: AuthedCtx, status: ApplicationStatus | undefined) {
  const year = await requireCurrentSchoolYear(ctx);
  const poleIds = ctx.permissions.has("poles:all")
    ? ("all" as const)
    : ctx.memberships.flatMap((m) => (m.role === "pole_lead" && m.poleId ? [m.poleId] : []));
  return toDtos(ctx, await findApplications(ctx.db, { schoolYearId: year.id, status, poleIds }));
}

async function reviewable(ctx: AuthedCtx, applicationId: string) {
  const row = await findApplication(ctx.db, applicationId);
  if (!row) throw notFound();
  const wishes = (await findWishes(ctx.db, [row.application.id])).get(row.application.id) ?? [];
  if (
    !canReview(
      ctx,
      wishes.map((w) => w.id),
    )
  )
    throw forbidden();
  if (row.application.status === "accepted" || row.application.status === "rejected") {
    throw new AppError("INVALID_STATUS_TRANSITION", 409, "Cette candidature est déjà tranchée.");
  }
  return { row, wishes };
}

export async function decide(
  ctx: AuthedCtx,
  applicationId: string,
  status: "interview" | "rejected",
) {
  const { row } = await reviewable(ctx, applicationId);
  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await setStatus(tx, row.application.id, status, ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: `application.${status}`,
      entity: "application",
      entityId: row.application.id,
      payload: { userId: row.user.id },
    });
    if (status === "rejected") {
      const url = `${ctx.services.webOrigin}/events`;
      defer(() => ctx.services.mailer.send(rejectedEmail(row.user, url)));
    }
  });
  return toDto(ctx, (await findApplication(ctx.db, row.application.id)) ?? row);
}

/** Accepting creates the membership (pole may differ from the wishes): a role change, audited. */
export async function accept(ctx: AuthedCtx, applicationId: string, poleId: string | undefined) {
  const { row, wishes } = await reviewable(ctx, applicationId);
  const targetPoleId = poleId ?? wishes[0]?.id;
  if (!targetPoleId) throw invalid("poleId", "Choisis le pôle d'affectation.");
  assertPoleAccess(ctx, targetPoleId);
  const target = await getPole(ctx, targetPoleId);
  if (await findActiveMembership(ctx.db, row.user.id, row.application.schoolYearId, target.id)) {
    throw new AppError("ALREADY_MEMBER", 409, `${row.user.name} est déjà membre de ce pôle.`);
  }
  await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    const membershipId = await insertMembership(tx, {
      userId: row.user.id,
      poleId: target.id,
      schoolYearId: row.application.schoolYearId,
      role: "member",
    });
    await setStatus(tx, row.application.id, "accepted", ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "membership.created",
      entity: "membership",
      entityId: membershipId,
      payload: { userId: row.user.id, poleId: target.id, applicationId: row.application.id },
    });
    const url = `${ctx.services.webOrigin}/home`;
    defer(() => ctx.services.mailer.send(acceptedEmail(row.user, target.name, url)));
  });
  return toDto(ctx, (await findApplication(ctx.db, row.application.id)) ?? row);
}
