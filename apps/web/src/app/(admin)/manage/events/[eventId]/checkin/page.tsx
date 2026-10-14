import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { CheckinScreen } from "@/features/checkin/checkin-screen";
import { getCheckinStats } from "@/features/checkin/queries";
import { getEventOr404 } from "@/features/events/queries";
import { MANAGE_EVENTS, manageTrail } from "@/lib/breadcrumbs";

export const metadata: Metadata = { title: "Pointage" };

export default async function CheckinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventOr404(eventId);
  if (!event.canManage) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pointage"
        breadcrumb={manageTrail(MANAGE_EVENTS, {
          label: event.title,
          href: `/manage/events/${event.id}`,
        })}
      />
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
