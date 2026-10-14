import type * as React from "react";
import { requireMe } from "@/lib/session";

/** Full-screen pages for a TV or a projector: signed in, no app navigation. */
export default async function ScreenLayout({ children }: { children: React.ReactNode }) {
  await requireMe();
  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground lg:px-10 lg:py-8">
      {children}
    </main>
  );
}
