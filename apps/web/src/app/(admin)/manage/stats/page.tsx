import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { MembersView } from "@/features/stats/members-view";
import { OverviewView } from "@/features/stats/overview";
import { getMemberInvolvement, getYearOverview } from "@/features/stats/queries";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };

const VIEWS = [
  ["overview", "L'année"],
  ["members", "Membres"],
] as const;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [me, { view: rawView }] = await Promise.all([requireMe(), searchParams]);
  if (!me.permissions.includes("stats:read")) notFound();
  const view = rawView === "members" ? "members" : "overview";
  const [overview, involvement] = await Promise.all([
    view === "overview" ? getYearOverview() : null,
    view === "members" ? getMemberInvolvement() : null,
  ]);
  const year = (overview ?? involvement)?.schoolYear.label;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Statistiques" description={year ? `Année ${year}` : undefined} />
      <nav aria-label="Vue" className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm">
        {VIEWS.map(([value, label]) => (
          <Link
            key={value}
            href={value === "overview" ? "/manage/stats" : "/manage/stats?view=members"}
            aria-current={view === value ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-full font-semibold",
              view === value ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {overview ? <OverviewView overview={overview} /> : null}
      {involvement ? <MembersView involvement={involvement} /> : null}
    </div>
  );
}
