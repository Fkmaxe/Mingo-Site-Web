"use server";

import type { CreateApplicationData } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import { documentType, rawBody, readUpload } from "@/lib/upload";
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

/** Hands in a file (form fields `file` and `name`); the API checks the type from the bytes. */
export async function handInFileAction(key: string, form: FormData): Promise<ActionResult> {
  const upload = readUpload(form, "document");
  if (!upload) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucun fichier.", fieldErrors: {} };
  }
  const { error } = await (await api()).POST("/v1/me/application/documents/{key}", {
    params: { path: { key }, query: { name: upload.name } },
    ...(await rawBody(upload.file, documentType(upload.file, upload.name))),
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
