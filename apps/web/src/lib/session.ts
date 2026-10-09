import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authHref } from "@/features/auth/safe-next";
import { api } from "./api";
import type { components } from "./api-schema";
import { PATHNAME_HEADER } from "./request-path";

export type Me = components["schemas"]["Me"];

/** Current user, or null without a valid session. Deduplicated within a request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const { data, response } = await (await api()).GET("/v1/me");
  if (response.status === 401) return null;
  if (!data) throw new Error(`GET /v1/me a échoué (${response.status})`);
  return data;
});

/** Current user; visitors are sent to the login page, then back to the page they asked for. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(authHref("/login", (await headers()).get(PATHNAME_HEADER)));
  return me;
}
