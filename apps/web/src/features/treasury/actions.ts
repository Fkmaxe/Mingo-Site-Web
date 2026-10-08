"use server";

import type { CreateTransactionData } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

const refresh = () => revalidatePath("/manage/treasury");

export async function createTransactionAction(input: CreateTransactionData): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/treasury/transactions", { body: input });
  if (error) return fromApiError(error);
  refresh();
  return { ok: true };
}

export async function reverseTransactionAction(transactionId: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/treasury/transactions/{transactionId}/reverse", {
    params: { path: { transactionId } },
  });
  if (error) return fromApiError(error);
  refresh();
  return { ok: true };
}

export async function setReceiptAction(
  transactionId: string,
  receiptUrl: string | null,
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/treasury/transactions/{transactionId}", {
    params: { path: { transactionId } },
    body: { receiptUrl },
  });
  if (error) return fromApiError(error);
  refresh();
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
  refresh();
  return { ok: true };
}
