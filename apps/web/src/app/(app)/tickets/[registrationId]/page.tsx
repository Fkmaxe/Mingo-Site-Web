import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QrCode } from "@/features/registrations/qr-code";
import { getTicketOr404 } from "@/features/registrations/queries";
import { formatEventRange } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Mon billet" };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const [me, ticket] = await Promise.all([
    requireMe(),
    params.then(({ registrationId }) => getTicketOr404(registrationId)),
  ]);
  const valid = ticket.status === "confirmed" && ticket.event.status !== "cancelled";
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-semibold text-xl leading-tight">{ticket.event.title}</h1>
        <p className="text-muted-foreground text-sm">{me.name}</p>
      </div>

      {valid ? (
        <>
          <QrCode value={ticket.qrToken} label={`QR code du billet pour ${ticket.event.title}`} />
          <p className="text-center text-muted-foreground text-sm">
            Montre ce QR code à l'entrée. Monte la luminosité de ton écran.
          </p>
        </>
      ) : ticket.status === "waitlisted" && ticket.event.status !== "cancelled" ? (
        <p role="status" className="rounded-md bg-warning/10 p-4 text-center text-warning">
          Tu es sur liste d'attente
          {ticket.waitlistPosition ? ` (position ${ticket.waitlistPosition})` : ""}. Ton QR code
          apparaîtra ici dès qu'une place se libère.
        </p>
      ) : (
        <p role="status" className="rounded-md bg-destructive/10 p-4 text-center text-destructive">
          {ticket.event.status === "cancelled"
            ? "L'événement est annulé : ce billet n'est plus valable."
            : "Tu t'es désinscrit·e : ce billet n'est plus valable."}
        </p>
      )}

      <ul className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <li className="flex gap-3">
          <CalendarDays aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <span className="first-letter:uppercase">
            {formatEventRange(ticket.event.startsAt, ticket.event.endsAt)}
          </span>
        </li>
        <li className="flex gap-3">
          <MapPin aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          {ticket.event.location}
        </li>
      </ul>
      <Link
        href={`/events/${ticket.event.slug}`}
        className="text-center text-primary text-sm underline-offset-4 hover:underline"
      >
        Voir l'événement
      </Link>
    </div>
  );
}
