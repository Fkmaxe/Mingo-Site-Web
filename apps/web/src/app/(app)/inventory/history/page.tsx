import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { HistoryList } from "@/features/inventory/history-list";
import { listHistory } from "@/features/inventory/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Historique de l'inventaire" };

export default async function InventoryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const [me, { cursor }] = await Promise.all([requireMe(), searchParams]);
  if (!me.permissions.includes("inventory:manage")) notFound();
  const history = await listHistory(cursor ? { cursor } : {});
  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/inventory"
        className="font-semibold text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Inventaire
      </Link>
      <PageHeader
        title="Historique"
        description="Toutes les actions sur le matériel, avec leur auteur."
      />
      <HistoryList movements={history.items} showItem />
      {history.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/inventory/history?cursor=${encodeURIComponent(history.nextCursor)}`}>
            Plus ancien
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
