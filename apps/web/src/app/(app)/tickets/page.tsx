import type { Metadata } from "next";
import Link from "next/link";
import { listMyTickets } from "@/features/registrations/queries";
import { TicketList } from "@/features/registrations/ticket-card";
import { cn } from "@/lib/utils";

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
      <h1 className="font-semibold text-2xl">Mes billets</h1>
      <nav aria-label="Période" className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["upcoming", "À venir", "/tickets"],
            ["past", "Passés", "/tickets?scope=past"],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            aria-current={scope === value ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-md font-medium",
              scope === value ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
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
