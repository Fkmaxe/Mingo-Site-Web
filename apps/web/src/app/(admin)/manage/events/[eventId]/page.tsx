import { ExternalLink, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DisplayTitle } from "@/components/brand";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DownloadLink } from "@/components/download-link";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/events/event-badges";
import { EventForm } from "@/features/events/event-form";
import { eventToForm } from "@/features/events/event-form-values";
import { EventManageActions } from "@/features/events/event-manage-actions";
import { manageablePoles } from "@/features/events/manageable-poles";
import { getEventOr404, listPoles } from "@/features/events/queries";
import { ShareButton } from "@/features/events/share-button";
import { LeagueManager } from "@/features/league/league-manager";
import { getEventLeague } from "@/features/league/queries";
import { listAllRegistrants, listTeams } from "@/features/registrations/queries";
import { RegistrantsList } from "@/features/registrations/registrants-table";
import { TeamsList } from "@/features/registrations/teams-list";
import { listStaffSlots } from "@/features/staff/queries";
import { StaffManager } from "@/features/staff/staff-manager";
import { EventStatsView } from "@/features/stats/event-stats";
import { getEventStats } from "@/features/stats/queries";
import { EventBudgetCard } from "@/features/treasury/event-budget";
import { getEventBudget } from "@/features/treasury/queries";
import { MANAGE_EVENTS, manageTrail } from "@/lib/breadcrumbs";
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
  const teamMinSize = event.teamMaxSize !== null ? event.teamMinSize : null;
  const [registrants, staffSlots, teams, stats, league, budget] = await Promise.all([
    event.status === "draft" ? [] : listAllRegistrants(event.id),
    listStaffSlots(event.id),
    event.status === "draft" || teamMinSize === null ? [] : listTeams(event.id),
    event.status === "draft" ? null : getEventStats(event.id),
    event.status === "draft" || event.status === "cancelled" ? null : getEventLeague(event.id),
    me.permissions.includes("budget:read") ? getEventBudget(event.id) : null,
  ]);
  const editable = event.status === "draft" || event.status === "published";
  // The current pole stays selectable even when the user cannot create events for it.
  const options = manageablePoles(me, poles);
  const current = poles.find((p) => p.id === event.pole.id);
  if (current && !options.includes(current)) options.push(current);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={manageTrail(MANAGE_EVENTS)} current={event.title} />
        <StatusBadge status={event.status} />
        <DisplayTitle className="text-2xl normal-case leading-tight">{event.title}</DisplayTitle>
        {event.status !== "draft" ? (
          <Link
            href={`/events/${event.slug}`}
            className="flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
          >
            Voir la page publique
            <ExternalLink aria-hidden className="size-4" />
          </Link>
        ) : null}
        {event.status === "published" ? (
          <ShareButton slug={event.slug} title={event.title} className="self-start" />
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

      {stats ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">Chiffres</h2>
          <EventStatsView stats={stats} />
        </section>
      ) : null}

      {budget ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">Budget</h2>
          <EventBudgetCard
            eventId={event.id}
            budget={budget}
            canManage={me.permissions.includes("budget:manage")}
          />
        </section>
      ) : null}

      {league ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">Ligue & tournoi</h2>
          <LeagueManager eventId={event.id} slug={event.slug} league={league} />
        </section>
      ) : null}

      {event.status !== "draft" && teamMinSize !== null ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">
            Équipes{" "}
            <span className="font-normal text-muted-foreground">
              ({event.confirmedTeamCount}
              {event.capacity === null ? "" : ` / ${event.capacity}`}
              {event.waitlistTeamCount > 0 ? `, ${event.waitlistTeamCount} en attente` : ""})
            </span>
          </h2>
          <TeamsList teams={teams} minSize={teamMinSize} />
        </section>
      ) : null}

      {event.status !== "draft" ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">
            Inscrits{" "}
            <span className="font-normal text-muted-foreground">
              ({event.confirmedCount}
              {event.capacity === null || teamMinSize !== null ? "" : ` / ${event.capacity}`})
            </span>
          </h2>
          <RegistrantsList registrants={registrants} fields={event.customFields} />
          {me.permissions.includes("exports:run") ? (
            <div className="flex flex-wrap gap-2">
              <DownloadLink href={`/manage/events/${event.id}/export/registrations`}>
                Inscrits (CSV)
              </DownloadLink>
              <DownloadLink href={`/manage/events/${event.id}/export/attendance`}>
                Présences (CSV)
              </DownloadLink>
            </div>
          ) : null}
        </section>
      ) : null}

      {editable ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-display text-lg">Staff</h2>
          <StaffManager eventId={event.id} slots={staffSlots} />
        </section>
      ) : null}

      {editable ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-bold font-display text-lg">Informations</h2>
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
