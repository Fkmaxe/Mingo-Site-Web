import type * as React from "react";
import { getMe } from "@/lib/session";
import { AppShell, PublicShell } from "./app-shell";

/** Public pages: signed-in users keep their navigation, visitors get the public header. */
export async function AdaptiveShell({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return me ? <AppShell me={me}>{children}</AppShell> : <PublicShell>{children}</PublicShell>;
}
