import { CalendarDays, Clock, MapPin, Shield, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandPanel, DisplayTitle, Pill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/events/event-badges";
import { getEventOr404 } from "@/features/events/queries";
import { getMyTeam } from "@/features/registrations/queries";
import { RegistrationPanel } from "@/features/registrations/registration-panel";
import { listStaffSlots } from "@/features/staff/queries";
import { StaffVolunteerPanel } from "@/features/staff/staff-volunteer-panel";
import { formatDateTime, formatEventRange, formatShortDay } from "@/lib/paris-time";
import { getMe } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventOr404((await params).slug);
  return { title: event.title, description: event.description.slice(0, 160) || undefined };
}

export default async function EventPage({ params }: Props) {
  const [event, me] = await Promise.all([getEventOr404((await params).slug), getMe()]);
  const isMember = me?.roles.includes("member") ?? false;
  const isTeamEvent = event.teamMinSize !== null && event.teamMaxSize !== null;
  const [staffSlots, team] = await Promise.all([
    isMember && event.status === "published" ? listStaffSlots(event.id) : [],
    isTeamEvent && event.myRegistration ? getMyTeam(event.id) : null,
  ]);
  return (
    <article className="flex flex-col gap-5">
      <BrandPanel className="flex flex-col gap-4 pt-6 pb-6">
        <div className="flex flex-wrap gap-2">
          {event.status !== "published" ? <StatusBadge status={event.status} /> : null}
          <Pill tone="glass" className="not-italic">
            Pôle {event.pole.name}
          </Pill>
          {event.visibility === "members" ? (
            <Pill tone="glass" className="not-italic">
              Membres
            </Pill>
          ) : null}
        </div>
        <DisplayTitle className="text-balance text-[2rem]">{event.title}</DisplayTitle>
        <div className="flex flex-wrap gap-2">
          <Pill tone="blue" className="text-base">
            <CalendarDays aria-hidden className="size-4" />
            <span className="first-letter:uppercase">{formatShortDay(event.startsAt)}</span>
          </Pill>
          <Pill tone="pink" className="text-base">
            <MapPin aria-hidden className="size-4" />
            {event.location}
          </Pill>
        </div>
      </BrandPanel>

      {event.status === "cancelled" ? (
        <p
          role="status"
          className="rounded-2xl bg-destructive/10 p-3 font-medium text-destructive text-sm"
        >
          Cet événement est annulé.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-primary/5 shadow-sm">
        <li className="flex gap-3">
          <CalendarDays aria-hidden className="size-5 shrink-0 text-primary" />
          <span className="first-letter:uppercase">
            {formatEventRange(event.startsAt, event.endsAt)}
          </span>
        </li>
        <li className="flex gap-3">
          <MapPin aria-hidden className="size-5 shrink-0 text-primary" />
          {event.location}
        </li>
        <li className="flex gap-3">
          <Users aria-hidden className="size-5 shrink-0 text-primary" />
          {event.capacity === null
            ? "Places illimitées"
            : isTeamEvent
              ? `${event.capacity} équipe${event.capacity > 1 ? "s" : ""}`
              : `${event.capacity} places`}
        </li>
        {isTeamEvent ? (
          <li className="flex gap-3">
            <Shield aria-hidden className="size-5 shrink-0 text-primary" />
            {event.teamMinSize === event.teamMaxSize
              ? `Équipes de ${event.teamMaxSize}`
              : `Équipes de ${event.teamMinSize} à ${event.teamMaxSize} personnes`}
          </li>
        ) : null}
        {event.registrationDeadline ? (
          <li className="flex gap-3">
            <Clock aria-hidden className="size-5 shrink-0 text-primary" />
            Inscriptions jusqu'au {formatDateTime(event.registrationDeadline)}
          </li>
        ) : null}
        {event.openPointsValue > 0 ? (
          <li className="flex gap-3">
            <Sparkles aria-hidden className="size-5 shrink-0 text-primary" />
            {event.openPointsValue} point{event.openPointsValue > 1 ? "s" : ""} open pour les
            participants
          </li>
        ) : null}
      </ul>

      {event.description ? (
        <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
      ) : null}

      {event.status !== "draft" ? (
        <RegistrationPanel event={event} signedIn={me !== null} team={team} />
      ) : null}

      <StaffVolunteerPanel slots={staffSlots} />

      {event.canManage ? (
        <Button asChild variant="outline" size="lg">
          <Link href={`/manage/events/${event.id}`}>Gérer l'événement</Link>
        </Button>
      ) : null}
    </article>
  );
}
