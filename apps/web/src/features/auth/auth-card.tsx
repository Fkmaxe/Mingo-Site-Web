import Link from "next/link";
import type * as React from "react";
import { DisplayTitle, Logo } from "@/components/brand";
import { Card, CardDescription } from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      {/* Poster gradient behind the logo, fading into the page. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-80 bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-32 -z-10 h-48 bg-linear-to-b from-transparent to-background"
      />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
        <Link href="/" className="self-center rounded-3xl" aria-label="Accueil BDE Mingo">
          <Logo size={120} priority className="drop-shadow-xl" />
        </Link>
        <Card className="gap-5 p-6 shadow-primary/10 shadow-xl">
          <div className="flex flex-col gap-1.5">
            <DisplayTitle className="text-2xl">{title}</DisplayTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {children}
        </Card>
        {footer ? <div className="text-center text-muted-foreground text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}
