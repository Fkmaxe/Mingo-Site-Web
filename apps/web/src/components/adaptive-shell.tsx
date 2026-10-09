import { headers } from "next/headers";
import type * as React from "react";
import { authHref } from "@/features/auth/safe-next";
import { PATHNAME_HEADER } from "@/lib/request-path";
import { getMe } from "@/lib/session";
import { AppShell, PublicShell } from "./app-shell";

/** Public pages: signed-in users keep their navigation, visitors get the public header. */
export async function AdaptiveShell({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (me) return <AppShell me={me}>{children}</AppShell>;
  const loginHref = authHref("/login", (await headers()).get(PATHNAME_HEADER));
  return <PublicShell loginHref={loginHref}>{children}</PublicShell>;
}
