import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { meetingAudience } from "@/features/meetings/labels";
import { listMeetings } from "@/features/meetings/queries";
import { HOME } from "@/lib/breadcrumbs";
import { formatDateTime } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

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
      <PageHeader
        title="Réunions"
        breadcrumb={[HOME]}
        action={
          me.permissions.includes("meetings:manage") ? (
            <Button asChild>
              <Link href="/meetings/new">Créer</Link>
            </Button>
          ) : null
        }
      />
      <SegmentedNav
        label="Période"
        fill
        active={scope}
        items={[
          { key: "upcoming", label: "À venir", href: "/meetings" },
          { key: "past", label: "Passées", href: "/meetings?scope=past" },
        ]}
      />
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
                  {meetingAudience(m)}
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
