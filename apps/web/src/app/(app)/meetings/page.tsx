import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { listMeetings } from "@/features/meetings/queries";
import { formatDateTime } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Réunions" };

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <Card>
        <CardDescription>Les réunions concernent les membres du BDE.</CardDescription>
      </Card>
    );
  }
  const scope = (await searchParams).scope === "past" ? "past" : "upcoming";
  const meetings = await listMeetings(scope);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
          Réunions
        </h1>
        {me.permissions.includes("meetings:manage") ? (
          <Button asChild>
            <Link href="/meetings/new">Créer</Link>
          </Button>
        ) : null}
      </div>
      <nav aria-label="Période" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["upcoming", "À venir", "/meetings"],
            ["past", "Passées", "/meetings?scope=past"],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            aria-current={scope === value ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-md font-medium",
              scope === value ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {meetings.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Aucune réunion.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link
                href={`/meetings/${m.id}`}
                className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm transition-colors hover:bg-accent/40"
              >
                <span className="font-semibold">{m.title}</span>
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CalendarDays aria-hidden className="size-4" />
                  <span className="first-letter:uppercase">{formatDateTime(m.startsAt)}</span>
                </span>
                {m.location ? (
                  <span className="flex items-center gap-2 text-muted-foreground text-sm">
                    <MapPin aria-hidden className="size-4" />
                    {m.location}
                  </span>
                ) : null}
                <span className="text-primary text-xs">
                  {m.pole ? `Pôle ${m.pole.name}` : "Réunion générale"}
                  {scope === "past" && m.present ? " · présent·e" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
