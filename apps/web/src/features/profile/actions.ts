"use server";

import type { UpdateProfileInput } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult> {
  const { error } = await (await api()).PATCH("/v1/me", { body: input });
  if (error) return fromApiError(error);
  // The name shows up in the whole signed-in layout, not only on the profile.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateClassAction(input: {
  levelId: string | null;
  trackId: string | null;
  rhythm: "initial" | "alternance" | null;
}): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/me/class", { body: input });
  if (error) return fromApiError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The photo is already cropped square and resized by the browser. */
export async function uploadAvatarAction(form: FormData): Promise<ActionResult> {
  const file = form.get("photo");
  if (!(file instanceof Blob)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Aucune photo.", fieldErrors: {} };
  }
  const { error } = await (await api()).PUT("/v1/me/avatar", {
    body: new Uint8Array(await file.arrayBuffer()) as unknown as string,
    bodySerializer: (body) => body as unknown as BodyInit,
    headers: { "content-type": "image/jpeg" },
  });
  if (error) return fromApiError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/me/avatar");
  if (error) return fromApiError(error);
  revalidatePath("/", "layout");
  return { ok: true };
}
