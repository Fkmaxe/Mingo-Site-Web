import { CalendarDays, Clock, MapPin, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, VisibilityBadge } from "@/features/events/event-badges";
import { getEventOr404 } from "@/features/events/queries";
import { RegistrationPanel } from "@/features/registrations/registration-panel";
import { formatDateTime, formatEventRange } from "@/lib/paris-time";
import { getMe } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventOr404((await params).slug);
  return { title: event.title, description: event.description.slice(0, 160) || undefined };
}

export default async function EventPage({ params }: Props) {
  const [event, me] = await Promise.all([getEventOr404((await params).slug), getMe()]);
  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={event.status} />
          <VisibilityBadge visibility={event.visibility} />
        </div>
        <h1 className="font-semibold text-2xl leading-tight">{event.title}</h1>
        <p className="text-primary text-sm">Pôle {event.pole.name}</p>
      </div>

      {event.status === "cancelled" ? (
        <p role="status" className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
          Cet événement est annulé.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <li className="flex gap-3">
          <CalendarDays aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <span className="first-letter:uppercase">
            {formatEventRange(event.startsAt, event.endsAt)}
          </span>
        </li>
        <li className="flex gap-3">
          <MapPin aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          {event.location}
        </li>
        <li className="flex gap-3">
          <Users aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          {event.capacity === null ? "Places illimitées" : `${event.capacity} places`}
        </li>
        {event.registrationDeadline ? (
          <li className="flex gap-3">
            <Clock aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            Inscriptions jusqu'au {formatDateTime(event.registrationDeadline)}
          </li>
        ) : null}
        {event.openPointsValue > 0 ? (
          <li className="flex gap-3">
            <Sparkles aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            {event.openPointsValue} point{event.openPointsValue > 1 ? "s" : ""} open pour les
            participants
          </li>
        ) : null}
      </ul>

      {event.description ? (
        <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
      ) : null}

      {event.status !== "draft" ? <RegistrationPanel event={event} signedIn={me !== null} /> : null}

      {event.canManage ? (
        <Button asChild variant="outline" size="lg">
          <Link href={`/manage/events/${event.id}`}>Gérer l'événement</Link>
        </Button>
      ) : null}
    </article>
  );
}
