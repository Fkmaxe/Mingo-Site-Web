import type { Metadata } from "next";
import { PageHeader } from "@/components/brand";
import { EventForm } from "@/features/events/event-form";
import { emptyEventForm } from "@/features/events/event-form-values";
import { manageablePoles } from "@/features/events/manageable-poles";
import { listPoles } from "@/features/events/queries";
import { MANAGE_EVENTS, manageTrail } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  const [me, poles] = await Promise.all([requireMe(), listPoles()]);
  const options = manageablePoles(me, poles);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Nouvel événement"
        description="Il est créé en brouillon : personne ne le voit avant sa publication."
        breadcrumb={manageTrail(MANAGE_EVENTS)}
      />
      <EventForm
        poles={options}
        defaultValues={emptyEventForm(options.length === 1 ? options[0]?.id : "")}
      />
    </div>
  );
}
