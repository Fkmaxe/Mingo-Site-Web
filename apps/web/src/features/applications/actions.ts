"use server";

import type { CreateApplicationInput } from "@bde/shared";
import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

function revalidate() {
  revalidatePath("/join");
  revalidatePath("/manage/applications");
}

export async function applyAction(input: CreateApplicationInput): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/applications", { body: input });
  if (error) return fromApiError(error);
  revalidate();
  return { ok: true };
}

export async function withdrawAction(): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/me/application");
  if (error) return fromApiError(error);
  revalidate();
  return { ok: true };
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
  if (error) return fromApiError(error);
  revalidate();
  return { ok: true };
}
