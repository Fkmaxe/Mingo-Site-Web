import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { api } from "./api";
import type { components } from "./api-schema";

export type Me = components["schemas"]["Me"];

/** Current user, or null without a valid session. Deduplicated within a request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const { data, response } = await (await api()).GET("/v1/me");
  if (response.status === 401) return null;
  if (!data) throw new Error(`GET /v1/me a échoué (${response.status})`);
  return data;
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}
