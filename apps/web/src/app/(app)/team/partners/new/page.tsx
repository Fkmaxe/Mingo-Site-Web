import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { listDirectory } from "@/features/members/queries";
import { PartnerForm } from "@/features/partners/partner-form";
import { HOME, PARTNERS, TEAM } from "@/lib/breadcrumbs";
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
      <PageHeader title="Nouveau partenaire" breadcrumb={[HOME, TEAM, PARTNERS]} />
      <PartnerForm owners={owners} />
    </div>
  );
}
