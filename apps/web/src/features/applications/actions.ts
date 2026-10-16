"use server";

import {
  type CreateApplicationData,
  DOCUMENT_FILE_TYPES,
  type DocumentFileType,
} from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { ApplicationFormInput } from "./types";

function revalidate() {
  revalidatePath("/join");
  revalidatePath("/manage/applications", "layout");
}

const done = (): ActionResult => {
  revalidate();
  return { ok: true };
};

export async function applyAction(input: CreateApplicationData): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/applications", { body: input });
  return error ? fromApiError(error) : done();
}

export async function withdrawAction(): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/me/application");
  return error ? fromApiError(error) : done();
}

export async function decideApplicationAction(
  applicationId: string,
  decision: { kind: "interview" | "rejected" } | { kind: "accept"; poleId: string },
): Promise<ActionResult> {
  const client = await api();
  const params = { params: { path: { applicationId } } };
  const { error } =
    decision.kind === "accept"
      ? await client.POST("/v1/applications/{applicationId}/accept", {
          ...params,
          body: { poleId: decision.poleId },
        })
      : await client.POST("/v1/applications/{applicationId}/decide", {
          ...params,
          body: { status: decision.kind },
        });
  return error ? fromApiError(error) : done();
}

export async function updateApplicationFormAction(
  input: ApplicationFormInput,
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/applications/form", { body: input });
  return error ? fromApiError(error) : done();
}

/** Office types by extension, for browsers that give no type (or a generic one). */
const TYPE_BY_EXTENSION: Record<string, DocumentFileType> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain",
  csv: "text/csv",
  pdf: "application/pdf",
};

/** Hands in a file (form fields `file` and `name`); the API checks the type from the bytes. */
export async function handInFileAction(key: string, form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  const rawName = form.get("name");
  if (!(file instanceof Blob)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucun fichier.", fieldErrors: {} };
  }
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "document";
  const declared = file.type.split(";")[0] ?? "";
  const type = (DOCUMENT_FILE_TYPES as readonly string[]).includes(declared)
    ? (declared as DocumentFileType)
    : (TYPE_BY_EXTENSION[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/pdf");
  const { error } = await (await api()).POST("/v1/me/application/documents/{key}", {
    params: { path: { key }, query: { name: name.slice(0, 200) } },
    // Raw file bytes, not JSON.
    body: new Uint8Array(await file.arrayBuffer()) as unknown as string,
    bodySerializer: (body) => body as unknown as BodyInit,
    headers: { "content-type": type },
  });
  return error ? fromApiError(error) : done();
}

export async function handInLinkAction(key: string, url: string): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/me/application/documents/{key}/link", {
    params: { path: { key } },
    body: { url },
  });
  return error ? fromApiError(error) : done();
}

export async function removeDocumentAction(key: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/me/application/documents/{key}", {
    params: { path: { key } },
  });
  return error ? fromApiError(error) : done();
}
