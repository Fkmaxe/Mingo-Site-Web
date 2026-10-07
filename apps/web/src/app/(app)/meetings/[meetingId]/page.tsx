import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { AttendanceList } from "@/features/meetings/attendance-list";
import { DeleteMeetingButton } from "@/features/meetings/delete-meeting-button";
import { MeetingForm } from "@/features/meetings/meeting-form";
import { getMeetingOr404 } from "@/features/meetings/queries";
import { formatDateTime } from "@/lib/paris-time";

export const metadata: Metadata = { title: "Réunion" };

export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const meeting = await getMeetingOr404((await params).meetingId);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-primary text-sm">
          {meeting.pole ? `Pôle ${meeting.pole.name}` : "Réunion générale"}
        </p>
        <h1 className="font-semibold text-2xl leading-tight">{meeting.title}</h1>
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <CalendarDays aria-hidden className="size-4" />
          <span className="first-letter:uppercase">{formatDateTime(meeting.startsAt)}</span>
        </p>
        {meeting.location ? (
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin aria-hidden className="size-4" />
            {meeting.location}
          </p>
        ) : null}
        {meeting.present ? (
          <p className="font-medium text-sm text-success">Tu étais présent·e.</p>
        ) : null}
      </div>

      {meeting.canManage ? (
        <>
          <AttendanceList meeting={meeting} />
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Ordre du jour et compte rendu</h2>
            <MeetingForm mode="edit" meeting={meeting} />
          </section>
          <DeleteMeetingButton meetingId={meeting.id} />
        </>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-lg">Ordre du jour</h2>
            <p className="whitespace-pre-line text-sm">
              {meeting.agenda || "Pas d'ordre du jour."}
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-lg">Compte rendu</h2>
            <p className="whitespace-pre-line text-sm">
              {meeting.minutes || "Le compte rendu n'est pas encore rédigé."}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
