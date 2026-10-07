import { notFound } from "next/navigation";
import type * as React from "react";
import { AppShell, canManageEvents } from "@/components/app-shell";
import { requireMe } from "@/lib/session";

/** Pole leads and board. The API checks every action again: this only shapes the UI. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (!canManageEvents(me)) notFound();
  return <AppShell me={me}>{children}</AppShell>;
}
