import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DisplayTitle, Logo } from "@/components/brand";
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
      <div className="overflow-hidden rounded-3xl border bg-card shadow-primary/15 shadow-xl">
        <div className="relative flex flex-col gap-2 bg-linear-to-br from-brand-magenta via-brand-violet to-brand-blue p-5 text-white">
          <Logo size={56} className="absolute top-3 right-3 rotate-6" />
          <span className="font-semibold text-white/85 text-xs uppercase tracking-[0.2em]">
            Billet
          </span>
          <DisplayTitle className="text-balance pr-14 text-2xl">{ticket.event.title}</DisplayTitle>
          <span className="font-medium text-sm">{me.name}</span>
          {ticket.team ? (
            <span className="text-sm text-white/85">Équipe {ticket.team.name}</span>
          ) : null}
        </div>
        {/* Perforation between the stub and the code. */}
        <div aria-hidden className="relative h-0 border-border border-t-2 border-dashed">
          <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background" />
          <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background" />
        </div>
        <div className="flex flex-col gap-3 p-5">
          {valid ? (
            <>
              {/* Always black on white, whatever the theme, so scanners read it. */}
              <div className="rounded-2xl bg-white p-2">
                <QrCode
                  value={ticket.qrToken}
                  label={`QR code du billet pour ${ticket.event.title}`}
                />
              </div>
              <p className="text-center text-muted-foreground text-sm">
                Montre ce QR code à l'entrée. Monte la luminosité de ton écran.
              </p>
            </>
          ) : ticket.status === "waitlisted" && ticket.event.status !== "cancelled" ? (
            <p role="status" className="rounded-2xl bg-warning/10 p-4 text-center text-warning">
              Tu es sur liste d'attente
              {ticket.waitlistPosition ? ` (position ${ticket.waitlistPosition})` : ""}. Ton QR code
              apparaîtra ici dès qu'une place se libère.
            </p>
          ) : (
            <p
              role="status"
              className="rounded-2xl bg-destructive/10 p-4 text-center text-destructive"
            >
              {ticket.event.status === "cancelled"
                ? "L'événement est annulé : ce billet n'est plus valable."
                : "Tu t'es désinscrit·e : ce billet n'est plus valable."}
            </p>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-primary/5 shadow-sm">
        <li className="flex gap-3">
          <CalendarDays aria-hidden className="size-5 shrink-0 text-primary" />
          <span className="first-letter:uppercase">
            {formatEventRange(ticket.event.startsAt, ticket.event.endsAt)}
          </span>
        </li>
        <li className="flex gap-3">
          <MapPin aria-hidden className="size-5 shrink-0 text-primary" />
          {ticket.event.location}
        </li>
      </ul>
      {ticket.questions.length > 0 ? (
        <dl className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm shadow-primary/5 shadow-sm">
          {ticket.questions.map(({ label, answer }) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{answer || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Link
        href={`/events/${ticket.event.slug}`}
        className="text-center font-semibold text-primary text-sm underline-offset-4 hover:underline"
      >
        Voir l'événement
      </Link>
    </div>
  );
}
