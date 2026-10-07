import type { Metadata } from "next";
import { EventForm } from "@/features/events/event-form";
import { emptyEventForm } from "@/features/events/event-form-values";
import { manageablePoles } from "@/features/events/manageable-poles";
import { listPoles } from "@/features/events/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  const [me, poles] = await Promise.all([requireMe(), listPoles()]);
  const options = manageablePoles(me, poles);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Nouvel événement</h1>
        <p className="text-muted-foreground text-sm">
          Il est créé en brouillon : personne ne le voit avant sa publication.
        </p>
      </div>
      <EventForm
        poles={options}
        defaultValues={emptyEventForm(options.length === 1 ? options[0]?.id : "")}
      />
    </div>
  );
}
