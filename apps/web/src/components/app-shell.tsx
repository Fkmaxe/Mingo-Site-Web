import Link from "next/link";
import type * as React from "react";
import { BottomNav, SideNav } from "./nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r p-4 md:flex md:flex-col md:gap-6">
        <Link href="/home" className="px-3 font-bold text-primary text-xl">
          BDE Mingo
        </Link>
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/home" className="font-bold text-lg text-primary">
            BDE Mingo
          </Link>
        </header>
        {/* Bottom padding keeps content above the mobile nav bar. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
