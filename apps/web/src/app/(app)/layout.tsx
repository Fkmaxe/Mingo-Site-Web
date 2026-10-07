import type * as React from "react";
import { AppShell } from "@/components/app-shell";
import { requireMe } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireMe();
  return <AppShell>{children}</AppShell>;
}
