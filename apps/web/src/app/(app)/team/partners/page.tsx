import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { PARTNER_STATUS_LABELS } from "@/features/partners/labels";
import { listPartners } from "@/features/partners/queries";
import { HOME, TEAM } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Partenaires (interne)" };

export default async function TeamPartnersPage() {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <Card>
        <CardDescription>Les fiches partenaires sont réservées aux membres du BDE.</CardDescription>
      </Card>
    );
  }
  const partners = await listPartners();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Partenaires"
        breadcrumb={[HOME, TEAM]}
        action={
          me.permissions.includes("partners:manage") ? (
            <Button asChild>
              <Link href="/team/partners/new">Ajouter</Link>
            </Button>
          ) : null
        }
      />
      {partners.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Aucun partenaire pour l'instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {partners.map((p) => (
            <li key={p.id}>
              <Link
                href={`/team/partners/${p.id}`}
                className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm transition-colors hover:bg-accent/40"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground text-xs">
                    {PARTNER_STATUS_LABELS[p.status]}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {p.owner ? `Référent : ${p.owner.name}` : "Pas de référent"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
