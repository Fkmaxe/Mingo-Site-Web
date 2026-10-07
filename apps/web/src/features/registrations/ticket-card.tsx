import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { formatEventRange } from "@/lib/paris-time";
import type { Ticket } from "./types";

export function TicketList({ tickets, empty }: { tickets: Ticket[]; empty: string }) {
  if (tickets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        {empty}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/tickets/${ticket.id}`}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <span className="font-semibold leading-tight">{ticket.event.title}</span>
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <CalendarDays aria-hidden className="size-4 shrink-0" />
              <span className="first-letter:uppercase">
                {formatEventRange(ticket.event.startsAt, ticket.event.endsAt, true)}
              </span>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {ticket.event.location}
            </span>
            {ticket.event.status === "cancelled" ? (
              <span className="font-medium text-destructive text-sm">Événement annulé</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
