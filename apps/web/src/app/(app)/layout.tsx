import type * as React from "react";
import { AppShell } from "@/components/app-shell";
import { requireMe } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return <AppShell me={me}>{children}</AppShell>;
}
