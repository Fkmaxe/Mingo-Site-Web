import type * as React from "react";
import { AppShell, PublicShell } from "@/components/app-shell";
import { getMe } from "@/lib/session";

/** Events are readable by visitors; signed-in users keep their navigation. */
export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return me ? <AppShell me={me}>{children}</AppShell> : <PublicShell>{children}</PublicShell>;
}
