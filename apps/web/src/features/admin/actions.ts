"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fromApiError } from "@/lib/action-result";
import { api } from "@/lib/api";

const done = (): ActionResult => {
  revalidatePath("/manage/admin", "layout");
  return { ok: true };
};

export async function setMembershipAction(input: {
  userId: string;
  role: "member" | "pole_lead" | "board";
  poleId: string | null;
  boardPosition: "president" | "vice_president" | "secretary" | "treasurer" | null;
}): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/admin/memberships", { body: input });
  return error ? fromApiError(error) : done();
}

export async function removeMembershipAction(id: string): Promise<ActionResult> {
  const { error } = await (await api()).DELETE("/v1/admin/memberships/{id}", {
    params: { path: { id } },
  });
  return error ? fromApiError(error) : done();
}

export async function setAdminAction(userId: string, isAdmin: boolean): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/admin/users/{id}/admin", {
    params: { path: { id: userId } },
    body: { isAdmin },
  });
  return error ? fromApiError(error) : done();
}

export async function createPoleAction(input: {
  name: string;
  description: string | null;
}): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/admin/poles", { body: input });
  return error ? fromApiError(error) : done();
}

export async function editPoleAction(
  id: string,
  input: { name: string; description: string | null },
): Promise<ActionResult> {
  const { error } = await (await api()).PUT("/v1/admin/poles/{id}", {
    params: { path: { id } },
    body: input,
  });
  return error ? fromApiError(error) : done();
}

export async function createSchoolYearAction(input: {
  label: string;
  startsOn: string;
  endsOn: string;
}): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/admin/school-years", { body: input });
  return error ? fromApiError(error) : done();
}

export async function setCurrentSchoolYearAction(id: string): Promise<ActionResult> {
  const { error } = await (await api()).POST("/v1/admin/school-years/{id}/current", {
    params: { path: { id } },
  });
  return error ? fromApiError(error) : done();
}
