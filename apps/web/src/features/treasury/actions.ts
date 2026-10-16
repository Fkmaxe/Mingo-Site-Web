"use server";

import { type CreateTransactionData, RECEIPT_TYPES, type ReceiptType } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { components } from "@/lib/api-schema";
import { rawBody } from "@/lib/upload";

type UpdateTransactionBody = components["schemas"]["UpdateTransactionInput"];

const refresh = (transactionId?: string) => {
  revalidatePath("/manage/treasury");
  if (transactionId) revalidatePath(`/manage/treasury/${transactionId}`);
};

export async function createTransactionAction(
  input: CreateTransactionData,
): Promise<ActionResult & { id?: string }> {
  const { data, error } = await (await api()).POST("/v1/treasury/transactions", { body: input });
  if (error) return fromApiError(error);
  refresh();
  return { ok: true, id: data.id };
}

/** Everything but the amount, the kind and the direction (ledger). */
export async function updateTransactionAction(
  transactionId: string,
  input: UpdateTransactionBody,
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/treasury/transactions/{transactionId}", {
    params: { path: { transactionId } },
    body: input,
  });
  if (error) return fromApiError(error);
  refresh(transactionId);
  return { ok: true };
}

export async function reverseTransactionAction(
  transactionId: string,
): Promise<ActionResult & { id?: string }> {
  const { data, error } = await (await api()).POST(
    "/v1/treasury/transactions/{transactionId}/reverse",
    { params: { path: { transactionId } } },
  );
  if (error) return fromApiError(error);
  refresh(transactionId);
  return { ok: true, id: data.id };
}

/** One receipt: a photo already resized by the browser, or a PDF as is. */
export async function uploadAttachmentAction(
  transactionId: string,
  form: FormData,
): Promise<ActionResult> {
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucun fichier.", fieldErrors: {} };
  }
  const name = form.get("name");
  // The API reads the real type from the bytes; this one only describes the body.
  const type: ReceiptType = (RECEIPT_TYPES as readonly string[]).includes(file.type)
    ? (file.type as ReceiptType)
    : "application/pdf";
  const { error } = await (await api()).POST(
    "/v1/treasury/transactions/{transactionId}/attachments",
    {
      params: {
        path: { transactionId },
        query: { name: typeof name === "string" && name.trim() ? name.trim() : "justificatif" },
      },
      ...(await rawBody(file, type)),
    },
  );
  if (error) return fromApiError(error);
  refresh(transactionId);
  return { ok: true };
}

export async function removeAttachmentAction(
  transactionId: string,
  attachmentId: string,
): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/treasury/attachments/{attachmentId}", {
    params: { path: { attachmentId } },
  });
  if (error) return fromApiError(error);
  refresh(transactionId);
  return { ok: true };
}

export async function setBudgetAction(
  eventId: string,
  budgetCents: number | null,
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/events/{eventId}/budget", {
    params: { path: { eventId } },
    body: { budgetCents },
  });
  if (error) return fromApiError(error);
  revalidatePath(`/manage/events/${eventId}`);
  return { ok: true };
}
