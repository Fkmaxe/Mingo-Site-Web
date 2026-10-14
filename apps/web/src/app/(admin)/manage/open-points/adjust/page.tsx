import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { AdjustForm } from "@/features/open-points/adjust-form";
import { manageTrail, OPEN_POINTS } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Ajuster des points open" };

export default async function AdjustOpenPointsPage() {
  const me = await requireMe();
  if (!me.permissions.includes("open-points:adjust")) notFound();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Ajustement manuel" breadcrumb={manageTrail(OPEN_POINTS)} />
      <p className="text-muted-foreground text-sm">
        L'ajustement est validé immédiatement et tracé dans le journal.
      </p>
      <AdjustForm />
    </div>
  );
}
