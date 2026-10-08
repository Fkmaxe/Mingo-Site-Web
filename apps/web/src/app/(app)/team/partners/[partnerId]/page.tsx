import type { Metadata } from "next";
import { listDirectory } from "@/features/members/queries";
import { PARTNER_STATUS_LABELS } from "@/features/partners/labels";
import { PartnerForm } from "@/features/partners/partner-form";
import { getPartnerOr404 } from "@/features/partners/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Partenaire" };

export default async function PartnerPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const [me, partner] = await Promise.all([
    requireMe(),
    params.then(({ partnerId }) => getPartnerOr404(partnerId)),
  ]);
  const isBoard = me.permissions.includes("partners:manage");
  if (partner.canEdit) {
    const owners = isBoard
      ? (await listDirectory()).map((e) => ({ membershipId: e.membershipId, name: e.user.name }))
      : undefined;
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display font-extrabold text-2xl italic leading-tight tracking-tight">
          {partner.name}
        </h1>
        <PartnerForm partner={partner} owners={owners} canDelete={isBoard} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display font-extrabold text-2xl italic leading-tight tracking-tight">
        {partner.name}
      </h1>
      <p className="text-sm">Statut : {PARTNER_STATUS_LABELS[partner.status]}</p>
      <p className="text-sm">Référent : {partner.owner?.name ?? "personne"}</p>
      {partner.contactName || partner.contactEmail ? (
        <p className="text-sm">
          Contact : {partner.contactName} {partner.contactEmail ? `· ${partner.contactEmail}` : ""}
        </p>
      ) : null}
      {partner.benefits ? <p className="whitespace-pre-line text-sm">{partner.benefits}</p> : null}
      {partner.notes ? (
        <p className="whitespace-pre-line rounded-xl border p-3 text-muted-foreground text-sm">
          {partner.notes}
        </p>
      ) : null}
    </div>
  );
}
