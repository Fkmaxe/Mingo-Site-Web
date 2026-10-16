import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { ApplicationFormSettings } from "@/features/applications/form-settings";
import { getApplicationForm } from "@/features/applications/queries";
import { listPoles } from "@/features/events/queries";
import { APPLICATIONS, manageTrail } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Formulaire de candidature" };

/** The bureau sets the year's application form. */
export default async function ApplicationFormPage() {
  const me = await requireMe();
  if (!me.permissions.includes("members:manage") || !me.permissions.includes("poles:all")) {
    notFound();
  }
  const [form, poles] = await Promise.all([getApplicationForm(), listPoles()]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Formulaire de candidature" breadcrumb={manageTrail(APPLICATIONS)} />
      <ApplicationFormSettings form={form} poles={poles} />
    </div>
  );
}
