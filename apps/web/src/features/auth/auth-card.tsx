import Link from "next/link";
import type * as React from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="font-bold text-2xl text-primary">
        BDE Mingo
      </Link>
      <Card>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {children}
      </Card>
      {footer ? <div className="text-center text-muted-foreground text-sm">{footer}</div> : null}
    </main>
  );
}
