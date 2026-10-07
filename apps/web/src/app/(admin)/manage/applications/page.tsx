import { APPLICATION_STATUSES, type ApplicationStatus } from "@bde/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationCard } from "@/features/applications/application-card";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/labels";
import { listApplications } from "@/features/applications/queries";
import { listPoles } from "@/features/events/queries";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

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
      <h1 className="font-semibold text-2xl">Candidatures</h1>
      <nav
        aria-label="Statut"
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm"
      >
        {[undefined, ...APPLICATION_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/manage/applications?status=${s}` : "/manage/applications"}
            aria-current={status === s ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center rounded-md px-3 font-medium",
              status === s ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {s ? APPLICATION_STATUS_LABELS[s] : "Toutes"}
          </Link>
        ))}
      </nav>
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
