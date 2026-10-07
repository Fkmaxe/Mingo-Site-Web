import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { listPublicPartners } from "@/features/partners/queries";

export const metadata: Metadata = { title: "Partenaires" };

export default async function PartnersPage() {
  const partners = await listPublicPartners();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-2xl">Nos partenaires</h1>
      <p className="text-muted-foreground text-sm">
        Les bons plans négociés par le BDE pour les élèves.
      </p>
      {partners.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
          Les partenariats arrivent bientôt.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <span className="font-semibold">{p.name}</span>
              {p.benefits ? <p className="whitespace-pre-line text-sm">{p.benefits}</p> : null}
              {p.website ? (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
                >
                  Site du partenaire
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
