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
