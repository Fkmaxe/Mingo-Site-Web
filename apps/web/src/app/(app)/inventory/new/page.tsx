import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { listPoles } from "@/features/events/queries";
import { ItemForm } from "@/features/inventory/item-form";
import { listCategories, listLocations } from "@/features/inventory/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Ajouter du matériel" };

export default async function NewItemPage() {
  const me = await requireMe();
  if (!me.permissions.includes("inventory:manage")) notFound();
  const [locations, categories, poles] = await Promise.all([
    listLocations(),
    listCategories(),
    listPoles(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Ajouter" description="Seul le nom est obligatoire." />
      <ItemForm locations={locations} categories={categories} poles={poles} />
    </div>
  );
}
