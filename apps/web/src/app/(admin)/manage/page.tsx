import { CalendarDays, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Gestion" };

export default async function ManagePage() {
  const me = await requireMe();
  const links = [
    {
      href: "/manage/events",
      title: "Événements",
      description: "Créer, publier, pointer les entrées",
      icon: CalendarDays,
      show: me.permissions.includes("events:create"),
    },
    {
      href: "/manage/open-points",
      title: "Points open",
      description: "Valider les points, ajuster un solde",
      icon: Sparkles,
      show: me.permissions.includes("open-points:validate"),
    },
    {
      href: "/manage/grades",
      title: "Notes des membres",
      description: "Points du pôle, validation et publication",
      icon: GraduationCap,
      show: me.permissions.includes("grades:propose"),
    },
  ].filter((link) => link.show);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-2xl">Gestion</h1>
      <ul className="flex flex-col gap-3">
        {links.map(({ href, title, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <Icon aria-hidden className="size-6 text-primary" />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">{title}</span>
                <span className="text-muted-foreground text-sm">{description}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
