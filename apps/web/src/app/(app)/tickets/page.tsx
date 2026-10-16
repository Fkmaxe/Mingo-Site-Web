import type { Metadata } from "next";
import { PageHeader } from "@/components/brand";
import { SegmentedNav } from "@/components/segmented-nav";
import { listMyTickets } from "@/features/registrations/queries";
import { TicketList } from "@/features/registrations/ticket-card";
import { HOME } from "@/lib/breadcrumbs";

export const metadata: Metadata = { title: "Mes billets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const scope = (await searchParams).scope === "past" ? "past" : "upcoming";
  const tickets = await listMyTickets(scope);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Mes billets" breadcrumb={[HOME]} />
      <SegmentedNav
        label="Période"
        fill
        active={scope}
        items={[
          { key: "upcoming", label: "À venir", href: "/tickets" },
          { key: "past", label: "Passés", href: "/tickets?scope=past" },
        ]}
      />
      <TicketList
        tickets={tickets}
        empty={
          scope === "upcoming"
            ? "Aucun billet. Inscris-toi à un événement pour en avoir un."
            : "Aucun billet passé."
        }
      />
    </div>
  );
}
