import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckinScreen } from "@/features/checkin/checkin-screen";
import { getCheckinStats } from "@/features/checkin/queries";
import { getEventOr404 } from "@/features/events/queries";

export const metadata: Metadata = { title: "Pointage" };

export default async function CheckinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventOr404(eventId);
  if (!event.canManage) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/manage/events/${event.id}`}
        className="flex items-center gap-1 text-muted-foreground text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {event.title}
      </Link>
      <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
        Pointage
      </h1>
      {event.status === "published" ? (
        <CheckinScreen eventId={event.id} initialStats={await getCheckinStats(event.id)} />
      ) : (
        <p className="text-muted-foreground">
          Le pointage n'est possible que pour un événement publié.
        </p>
      )}
    </div>
  );
}
