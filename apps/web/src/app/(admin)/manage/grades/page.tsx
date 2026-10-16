import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { SegmentedNav } from "@/components/segmented-nav";
import { GradeRow } from "@/features/grades/grade-row";
import { GenerateQuartersButton, GradesActionsBar } from "@/features/grades/grades-actions-bar";
import { PeriodSettings } from "@/features/grades/period-settings";
import { listGrades, listPeriods } from "@/features/grades/queries";
import { manageTrail } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Notes des membres" };

export default async function ManageGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await requireMe();
  if (!me.permissions.includes("grades:propose")) notFound();
  const isBoard = me.permissions.includes("grades:validate");
  const periods = await listPeriods();

  if (periods.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Notes des membres" breadcrumb={manageTrail()} />
        <p className="text-muted-foreground text-sm">Aucune période de notation cette année.</p>
        {isBoard ? <GenerateQuartersButton /> : null}
      </div>
    );
  }

  const requested = (await searchParams).period;
  const period = periods.find((p) => p.id === requested) ?? periods[0];
  if (!period) notFound();
  const grades = await listGrades(period.id);
  const ledPoles = me.memberships.flatMap((m) =>
    m.role === "pole_lead" && m.pole ? [m.pole] : [],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Notes des membres" breadcrumb={manageTrail()} />
      <SegmentedNav
        label="Période"
        active={period.id}
        items={periods.map((p) => ({
          key: p.id,
          label: p.label,
          href: `/manage/grades?period=${p.id}`,
        }))}
      />
      <p className="text-muted-foreground text-sm">
        Note = présence ({period.pointsPerPresence} pt par événement, sauf réglage de l'événement) +
        points du pôle, plafonnée à {period.scaleMax}.
      </p>

      {isBoard ? <PeriodSettings key={period.id} period={period} /> : null}

      <GradesActionsBar
        periodId={period.id}
        isBoard={isBoard}
        submittable={ledPoles.map((pole) => ({
          poleId: pole.id,
          poleName: pole.name,
          drafts: grades.filter((g) => g.pole.id === pole.id && g.status === "draft" && g.id)
            .length,
        }))}
        submittedIds={grades.flatMap((g) => (g.status === "submitted" && g.id ? [g.id] : []))}
        validatedIds={grades.flatMap((g) => (g.status === "validated" && g.id ? [g.id] : []))}
      />

      {grades.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun membre à noter.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {grades.map((grade) => (
            <GradeRow
              key={`${grade.membershipId}-${grade.status}`}
              periodId={period.id}
              grade={grade}
              scaleMax={period.scaleMax}
              canEditFrozen={isBoard}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
