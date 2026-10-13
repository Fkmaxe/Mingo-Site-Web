import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { listPoles } from "@/features/events/queries";
import { MeetingForm } from "@/features/meetings/meeting-form";
import { HOME, MEETINGS } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvelle réunion" };

export default async function NewMeetingPage() {
  const me = await requireMe();
  if (!me.permissions.includes("meetings:manage")) notFound();
  const isBoard = me.permissions.includes("poles:all");
  const poles = isBoard
    ? await listPoles()
    : me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole] : []));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Nouvelle réunion" breadcrumb={[HOME, MEETINGS]} />
      <MeetingForm mode="create" poles={poles} allowGeneral={isBoard} />
    </div>
  );
}
