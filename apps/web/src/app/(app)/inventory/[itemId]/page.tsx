import { Package } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DisplayTitle } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { listEvents, listPoles } from "@/features/events/queries";
import { ConditionBadge } from "@/features/inventory/condition-badge";
import { HistoryList } from "@/features/inventory/history-list";
import { ItemActions } from "@/features/inventory/item-actions";
import { getItemOr404, listHistory, listLocations } from "@/features/inventory/queries";
import { QrCode } from "@/features/registrations/qr-code";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Matériel" };

/** Absolute URL of this page, for the label's QR code (scanned by any phone camera). */
async function selfUrl(path: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const [{ itemId }, { cursor }, me] = await Promise.all([params, searchParams, requireMe()]);
  if (!me.permissions.includes("inventory:manage")) notFound();
  const [item, locations, poles, events, history] = await Promise.all([
    getItemOr404(itemId),
    listLocations(),
    listPoles(),
    listEvents({ limit: 50 }),
    listHistory({ itemId, ...(cursor ? { cursor } : {}) }),
  ]);
  const url = await selfUrl(`/inventory/${item.id}`);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/inventory"
        className="font-semibold text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Inventaire
      </Link>

      {item.photoUrl ? (
        // biome-ignore lint/performance/noImgElement: private photo through the web proxy.
        <img
          src={item.photoUrl}
          alt={item.name}
          className="aspect-video w-full rounded-3xl bg-muted object-cover"
        />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Package aria-hidden className="size-10" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-mono font-semibold text-muted-foreground text-sm">{item.code}</span>
        <DisplayTitle className="text-2xl normal-case">{item.name}</DisplayTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ConditionBadge condition={item.condition} />
          <span className="text-muted-foreground">
            {item.location?.name ?? "Lieu non renseigné"}
            {item.category ? ` · ${item.category}` : ""}
            {item.pole ? ` · Pôle ${item.pole.name}` : ""}
          </span>
        </div>
        {item.kind === "stock" ? (
          <p className="text-sm">
            <strong className="font-semibold">{item.available}</strong> disponible
            {item.available > 1 ? "s" : ""} sur {item.quantity}
          </p>
        ) : null}
        {item.description ? (
          <p className="whitespace-pre-line text-sm">{item.description}</p>
        ) : null}
      </div>

      <ItemActions
        item={item}
        locations={locations}
        poles={poles}
        events={events.items.map((e) => ({ id: e.id, title: e.title }))}
        myName={me.name}
        canArchive={me.permissions.includes("inventory:archive")}
      />

      <details className="rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
        <summary className="cursor-pointer font-bold font-display">Étiquette à coller</summary>
        <div className="mx-auto mt-4 flex max-w-48 flex-col items-center gap-2">
          <QrCode value={url} label={`QR code de ${item.code}`} />
          <span className="font-bold font-mono text-lg">{item.code}</span>
          <span className="text-center text-muted-foreground text-xs">
            Scanne-le avec l'appareil photo pour ouvrir cette fiche.
          </span>
        </div>
      </details>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-display text-lg">Historique</h2>
        <HistoryList movements={history.items} />
        {history.nextCursor ? (
          <Button asChild variant="outline">
            <Link href={`/inventory/${item.id}?cursor=${encodeURIComponent(history.nextCursor)}`}>
              Plus ancien
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
