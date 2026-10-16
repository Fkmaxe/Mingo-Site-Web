import { APPLICATION_STATUSES, type ApplicationStatus } from "@bde/shared";
import { Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { ApplicationCard } from "@/features/applications/application-card";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/labels";
import { listApplications } from "@/features/applications/queries";
import { listPoles } from "@/features/events/queries";
import { manageTrail } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Candidatures" };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await requireMe();
  if (!me.permissions.includes("members:manage")) notFound();
  const requested = (await searchParams).status;
  const status = APPLICATION_STATUSES.find((s) => s === requested) as ApplicationStatus | undefined;
  const isBoard = me.permissions.includes("poles:all");
  const [applications, allPoles] = await Promise.all([listApplications(status), listPoles()]);
  // A lead places recruits in the poles they lead; the board anywhere.
  const led = new Set(
    me.memberships.flatMap((m) => (m.role === "pole_lead" && m.pole ? [m.pole.id] : [])),
  );
  const poles = isBoard ? allPoles : allPoles.filter((p) => led.has(p.id));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Candidatures" breadcrumb={manageTrail()} />
      {isBoard ? (
        <Button asChild variant="outline" className="self-start">
          <Link href="/manage/applications/settings">
            <Settings2 aria-hidden />
            Configurer le formulaire
          </Link>
        </Button>
      ) : null}
      <SegmentedNav
        label="Statut"
        active={status ?? "all"}
        items={[
          { key: "all", label: "Toutes", href: "/manage/applications" },
          ...APPLICATION_STATUSES.map((s) => ({
            key: s,
            label: APPLICATION_STATUS_LABELS[s],
            href: `/manage/applications?status=${s}`,
          })),
        ]}
      />
      {applications.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Aucune candidature.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((a) => (
            <ApplicationCard key={`${a.id}-${a.status}`} application={a} poles={poles} />
          ))}
        </ul>
      )}
    </div>
  );
}
