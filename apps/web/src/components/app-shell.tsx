import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/initials";
import type { Me } from "@/lib/session";
import { Logo } from "./brand";
import { BottomNav, SideNav } from "./nav";

export function canManageEvents(me: Me) {
  return me.permissions.includes("events:create");
}

/** Soft pink glow at the top of every page, echoing the posters' gradient. */
function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-linear-to-b from-brand-pink/25 via-brand-lavender/10 to-transparent"
    />
  );
}

function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <Link href="/home" className="flex items-center gap-2.5 rounded-full">
      <Logo size={size} priority />
      <span className="font-display font-extrabold text-lg uppercase italic tracking-tight">
        BDE Mingo
      </span>
    </Link>
  );
}

/** Signed-in layout: bottom nav on phones, sidebar from md up. */
export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const canManage = canManageEvents(me);
  return (
    <div className="isolate min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <Backdrop />
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-card/60 p-5 backdrop-blur md:flex">
        <Link href="/home" className="flex flex-col items-center gap-2 rounded-2xl pt-2">
          <Logo size={96} priority />
        </Link>
        <SideNav canManage={canManage} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md md:hidden">
          <Wordmark />
          <Link
            href="/profile"
            aria-label={`Mon profil (${me.name})`}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary font-display font-extrabold text-primary-foreground text-sm italic"
            >
              {initials(me.firstName, me.lastName)}
            </span>
          </Link>
        </header>
        {/* Bottom padding keeps content above the mobile nav bar. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-12">
          {children}
        </main>
      </div>
      <BottomNav canManage={canManage} />
    </div>
  );
}

/** Visitor layout for public pages. `loginHref` brings the visitor back here after login. */
export function PublicShell({
  loginHref = "/login",
  children,
}: {
  loginHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="isolate flex min-h-dvh flex-col">
      <Backdrop />
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <Wordmark />
          <Button asChild size="sm">
            <Link href={loginHref}>Se connecter</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-12 md:px-8">{children}</main>
    </div>
  );
}
