import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PendingReview } from "@/features/open-points/pending-review";
import { listAllPending } from "@/features/open-points/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Points open à valider" };

export default async function ManageOpenPointsPage() {
  const me = await requireMe();
  if (!me.permissions.includes("open-points:validate")) notFound();
  const pending = await listAllPending();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">Points open</h1>
        {me.permissions.includes("open-points:adjust") ? (
          <Button asChild variant="outline">
            <Link href="/manage/open-points/adjust">Ajuster</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        Points gagnés aux événements, en attente de validation avant transmission à l'école.
      </p>
      <PendingReview key={pending.map((p) => p.id).join()} entries={pending} />
    </div>
  );
}
