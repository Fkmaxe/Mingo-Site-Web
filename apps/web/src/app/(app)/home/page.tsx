import {
  ClipboardList,
  type LucideIcon,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandPanel, DisplayTitle, Logo } from "@/components/brand";
import { EventList } from "@/features/events/event-card";
import { listEvents } from "@/features/events/queries";
import { formatPoints } from "@/features/open-points/labels";
import { getMyOpenPoints } from "@/features/open-points/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Accueil" };

type Shortcut = { href: string; label: string; hint: string; icon: LucideIcon };

function Shortcuts({ items }: { items: Shortcut[] }) {
  return (
    <ul
      className={
        items.length === 4 ? "grid grid-cols-2 gap-3 lg:grid-cols-4" : "grid grid-cols-2 gap-3"
      }
    >
      {items.map(({ href, label, hint, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="font-bold font-display leading-tight">{label}</span>
            <span className="text-muted-foreground text-xs">{hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const [me, upcoming, points] = await Promise.all([
    requireMe(),
    listEvents({ limit: 3 }),
    getMyOpenPoints(),
  ]);
  const firstName = me.name.split(" ")[0];
  const shortcuts: Shortcut[] = points.isMember
    ? [
        { href: "/tickets", label: "Mes billets", hint: "QR code à l'entrée", icon: Ticket },
        { href: "/tasks", label: "Mes tâches", hint: "Le tableau du pôle", icon: ClipboardList },
        { href: "/meetings", label: "Réunions", hint: "Ordres du jour, CR", icon: Video },
        { href: "/team", label: "L'équipe", hint: "Annuaire, partenaires", icon: Users },
      ]
    : [
        { href: "/tickets", label: "Mes billets", hint: "QR code à l'entrée", icon: Ticket },
        { href: "/join", label: "Rejoindre le BDE", hint: "Candidater à un pôle", icon: UserPlus },
      ];

  return (
    <div className="flex flex-col gap-6">
      <BrandPanel className="flex flex-col gap-4">
        <Logo
          size={88}
          className="pointer-events-none absolute -right-3 -bottom-3 rotate-6 opacity-90"
        />
        <div className="flex flex-col gap-1 pr-20">
          <p className="font-semibold text-sm text-white/85">Salut {firstName} 👋</p>
          <DisplayTitle className="text-[1.65rem]">Prêt·e pour la suite ?</DisplayTitle>
        </div>
        {points.isMember ? (
          <p className="pr-20 text-sm text-white/90">
            Merci de faire vivre le BDE. Tes tâches et réunions sont juste en dessous.
          </p>
        ) : (
          <Link
            href="/points"
            className="flex w-fit items-center gap-3 rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur transition-colors hover:bg-white/25"
          >
            <Sparkles aria-hidden className="size-5" />
            <span className="flex flex-col leading-tight">
              <span className="text-white/85 text-xs">Mes points open</span>
              <span className="font-display font-extrabold text-2xl italic tabular-nums">
                {formatPoints(points.balance)}
              </span>
            </span>
            {points.pending !== 0 ? (
              <span className="text-white/85 text-xs">
                + {formatPoints(points.pending)} en attente
              </span>
            ) : null}
          </Link>
        )}
      </BrandPanel>

      <Shortcuts items={shortcuts} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold font-display text-lg">Prochains événements</h2>
          <Link
            href="/events"
            className="font-semibold text-primary text-sm underline-offset-4 hover:underline"
          >
            Tout voir
          </Link>
        </div>
        <EventList events={upcoming.items} empty="Aucun événement prévu pour l'instant." />
      </section>
    </div>
  );
}
