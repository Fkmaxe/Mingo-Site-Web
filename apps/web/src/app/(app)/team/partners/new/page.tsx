import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listDirectory } from "@/features/members/queries";
import { PartnerForm } from "@/features/partners/partner-form";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Nouveau partenaire" };

export default async function NewPartnerPage() {
  const me = await requireMe();
  if (!me.permissions.includes("partners:manage")) notFound();
  const owners = (await listDirectory()).map((e) => ({
    membershipId: e.membershipId,
    name: e.user.name,
  }));
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
        Nouveau partenaire
      </h1>
      <PartnerForm owners={owners} />
    </div>
  );
}
