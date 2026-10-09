"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";
import type { ItemCondition } from "./types";

type WithId = ActionResult & { id?: string };

const refresh = (id?: string) => {
  revalidatePath("/inventory", "layout");
  if (id) revalidatePath(`/inventory/${id}`);
};

export async function createItemAction(input: {
  name: string;
  description: string;
  category: string | null;
  kind: "unique" | "stock";
  quantity: number;
  condition: ItemCondition;
  locationId: string | null;
  poleId: string | null;
}): Promise<WithId> {
  const { data, error } = await (await api()).POST("/v1/inventory/items", { body: input });
  if (error) return fromApiError(error);
  refresh();
  return { ok: true, id: data.id };
}

export async function editItemAction(
  id: string,
  input: {
    name?: string;
    description?: string;
    category?: string | null;
    condition?: ItemCondition;
    locationId?: string | null;
    poleId?: string | null;
    note?: string;
  },
): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/inventory/items/{id}", {
    params: { path: { id } },
    body: { ...input, note: input.note ?? "" },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function adjustAction(id: string, delta: number, note: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/inventory/items/{id}/adjust", {
    params: { path: { id } },
    body: { delta, note },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function checkoutAction(
  id: string,
  input: {
    quantity: number;
    holder: string;
    eventId: string | null;
    dueAt: string | null;
    note: string;
  },
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/inventory/items/{id}/checkouts", {
    params: { path: { id } },
    body: input,
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function returnAction(
  itemId: string,
  checkoutId: string,
  condition: ItemCondition,
  note: string,
): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/inventory/checkouts/{id}/return", {
    params: { path: { id: checkoutId } },
    body: { condition, note },
  });
  if (error) return fromApiError(error);
  refresh(itemId);
  return { ok: true };
}

export async function archiveAction(id: string, note: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/inventory/items/{id}/archive", {
    params: { path: { id } },
    body: { note },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function restoreAction(id: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/inventory/items/{id}/restore", {
    params: { path: { id } },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function createLocationAction(
  name: string,
): Promise<ActionResult & { locations?: { id: string; name: string }[] }> {
  const { data, error } = await (await api()).POST("/v1/inventory/locations", { body: { name } });
  if (error) return fromApiError(error);
  refresh();
  return { ok: true, locations: data };
}

/** The photo is already resized by the browser (resize-photo.ts). */
export async function uploadPhotoAction(id: string, form: FormData): Promise<ActionResult> {
  const file = form.get("photo");
  if (!(file instanceof Blob))
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucune photo.", fieldErrors: {} };
  const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await (await api()).PUT("/v1/inventory/items/{id}/photo", {
    params: { path: { id } },
    // Raw image bytes, not JSON.
    body: bytes as unknown as string,
    bodySerializer: (body) => body as unknown as BodyInit,
    headers: { "content-type": type },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}

export async function removePhotoAction(id: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/inventory/items/{id}/photo", {
    params: { path: { id } },
  });
  if (error) return fromApiError(error);
  refresh(id);
  return { ok: true };
}
