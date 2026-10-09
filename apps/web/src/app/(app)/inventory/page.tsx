import { History, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ItemList } from "@/features/inventory/item-list";
import { listItems, listLocations } from "@/features/inventory/queries";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventaire" };

const STATUSES = [
  ["all", "Tout"],
  ["available", "Disponible"],
  ["out", "Sorti"],
  ["overdue", "En retard"],
] as const;
type Status = (typeof STATUSES)[number][0];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; lieu?: string; archives?: string }>;
}) {
  const [me, params] = await Promise.all([requireMe(), searchParams]);
  if (!me.permissions.includes("inventory:manage")) notFound();
  const q = params.q?.trim() || undefined;
  const status = (STATUSES.find(([v]) => v === params.status)?.[0] ?? "all") as Status;
  const archived = params.archives === "1";
  const [items, locations] = await Promise.all([
    listItems({ q, status, locationId: params.lieu || undefined, archived }),
    listLocations(),
  ]);
  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q, status, lieu: params.lieu, archives: archived ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "all") next.set(k, v);
    const s = next.toString();
    return s ? `/inventory?${s}` : "/inventory";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventaire"
        description={`${items.length} objet${items.length > 1 ? "s" : ""}${archived ? " archivés" : ""}`}
        action={
          <Button asChild variant="ghost" size="icon" aria-label="Historique de l'inventaire">
            <Link href="/inventory/history">
              <History aria-hidden />
            </Link>
          </Button>
        }
      />

      <form action="/inventory" className="flex flex-col gap-2">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        {archived ? <input type="hidden" name="archives" value="1" /> : null}
        <div className="flex gap-2">
          <label htmlFor="inventory-search" className="sr-only">
            Rechercher
          </label>
          <Input
            id="inventory-search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nom, catégorie ou code (INV-0042)"
            autoComplete="off"
          />
          <Button type="submit" size="icon" aria-label="Rechercher">
            <Search aria-hidden />
          </Button>
        </div>
        <label htmlFor="inventory-location" className="sr-only">
          Lieu
        </label>
        <NativeSelect id="inventory-location" name="lieu" defaultValue={params.lieu ?? ""}>
          <option value="">Tous les lieux</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.itemCount})
            </option>
          ))}
        </NativeSelect>
      </form>

      <nav aria-label="Filtre" className="flex flex-wrap gap-2">
        {STATUSES.map(([value, label]) => (
          <Link
            key={value}
            href={link({ status: value })}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-full border px-3 font-semibold text-sm",
              status === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
        <Link
          href={link({ archives: archived ? undefined : "1" })}
          className="flex min-h-9 items-center rounded-full px-3 font-semibold text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {archived ? "Voir l'inventaire" : "Archives"}
        </Link>
      </nav>

      <ItemList
        items={items}
        empty={
          q || params.lieu || status !== "all"
            ? "Rien ne correspond."
            : "L'inventaire est vide : ajoute le premier objet."
        }
      />

      {archived ? null : (
        <Button
          asChild
          size="lg"
          className="fixed right-4 bottom-24 z-30 shadow-lg md:right-8 md:bottom-8"
        >
          <Link href="/inventory/new">
            <Plus aria-hidden />
            Ajouter
          </Link>
        </Button>
      )}
    </div>
  );
}
