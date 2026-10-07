import { ExternalLink, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/events/event-badges";
import { EventForm } from "@/features/events/event-form";
import { eventToForm } from "@/features/events/event-form-values";
import { EventManageActions } from "@/features/events/event-manage-actions";
import { manageablePoles } from "@/features/events/manageable-poles";
import { getEventOr404, listPoles } from "@/features/events/queries";
import { listAllRegistrants } from "@/features/registrations/queries";
import { RegistrantsList } from "@/features/registrations/registrants-table";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Gérer l'événement" };

export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ eventId }, { created }] = await Promise.all([params, searchParams]);
  const [me, event, poles] = await Promise.all([requireMe(), getEventOr404(eventId), listPoles()]);
  if (!event.canManage) notFound();
  const registrants = event.status === "draft" ? [] : await listAllRegistrants(event.id);
  const editable = event.status === "draft" || event.status === "published";
  // The current pole stays selectable even when the user cannot create events for it.
  const options = manageablePoles(me, poles);
  const current = poles.find((p) => p.id === event.pole.id);
  if (current && !options.includes(current)) options.push(current);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StatusBadge status={event.status} />
        <h1 className="font-semibold text-2xl leading-tight">{event.title}</h1>
        {event.status !== "draft" ? (
          <Link
            href={`/events/${event.slug}`}
            className="flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
          >
            Voir la page publique
            <ExternalLink aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
      {created ? (
        <FormAlert tone="success">Brouillon créé. Publie-le quand il est prêt.</FormAlert>
      ) : null}

      {event.status === "published" ? (
        <Button asChild size="lg">
          <Link href={`/manage/events/${event.id}/checkin`}>
            <ScanLine aria-hidden />
            Pointer les entrées
          </Link>
        </Button>
      ) : null}

      <EventManageActions event={event} />

      {event.status !== "draft" ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg">
            Inscrits{" "}
            <span className="font-normal text-muted-foreground">
              ({event.confirmedCount}
              {event.capacity === null ? "" : ` / ${event.capacity}`})
            </span>
          </h2>
          <RegistrantsList registrants={registrants} />
        </section>
      ) : null}

      {editable ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-lg">Informations</h2>
          <EventForm
            eventId={event.id}
            poles={manageablePoles(me, poles).concat(
              poles.filter(
                (p) => p.id === event.pole.id && !manageablePoles(me, poles).includes(p),
              ),
            )}
            defaultValues={eventToForm(event)}
          />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          Un événement annulé ou terminé ne peut plus être modifié.
        </p>
      )}
    </div>
  );
}
