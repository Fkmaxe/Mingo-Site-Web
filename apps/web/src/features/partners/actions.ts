"use server";

import type { CreatePartnerData } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

function revalidate() {
  revalidatePath("/team/partners", "layout");
  revalidatePath("/partners");
}

export async function createPartnerAction(input: CreatePartnerData): Promise<ActionResult> {
  const { data, error } = await (await api()).POST("/v1/partners", { body: input });
  if (error) return fromApiError(error);
  revalidate();
  redirect(`/team/partners/${data.id}`);
}

/** `ownerMembershipId` is only sent by the board (referents cannot reassign). */
export async function updatePartnerAction(
  partnerId: string,
  input: Omit<CreatePartnerData, "ownerMembershipId"> & { ownerMembershipId?: string | null },
): Promise<ActionResult> {
  const { ownerMembershipId, ...fields } = input;
  const { error } = await (await api()).PATCH("/v1/partners/{partnerId}", {
    params: { path: { partnerId } },
    body: ownerMembershipId === undefined ? fields : { ...fields, ownerMembershipId },
  });
  if (error) return fromApiError(error);
  revalidate();
  return { ok: true };
}

export async function deletePartnerAction(partnerId: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/partners/{partnerId}", {
    params: { path: { partnerId } },
  });
  if (error) return fromApiError(error);
  revalidate();
  redirect("/team/partners");
}
