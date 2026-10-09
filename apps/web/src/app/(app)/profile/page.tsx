import {
  ChevronRight,
  ClipboardList,
  GraduationCap,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandPanel, DisplayTitle } from "@/components/brand";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ProfileNameForm } from "@/features/profile/profile-name-form";
import { NotificationsCard } from "@/features/push/notifications-card";
import { getPushSetup } from "@/features/push/queries";
import { initials } from "@/lib/initials";
import { BOARD_POSITION_LABELS, MEMBERSHIP_ROLE_LABELS, ROLE_LABELS } from "@/lib/labels";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Profil" };

type Row = { href: string; label: string; icon: LucideIcon };

export default async function ProfilePage() {
  const [me, push] = await Promise.all([requireMe(), getPushSetup()]);
  const rows: Row[] = me.roles.includes("member")
    ? [
        { href: "/grades", label: "Ma note et mes présences", icon: GraduationCap },
        { href: "/tasks", label: "Mes tâches", icon: ClipboardList },
      ]
    : [{ href: "/points", label: "Mes points open", icon: Sparkles }];
  return (
    <div className="flex flex-col gap-6">
      <BrandPanel className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/20 font-display font-extrabold text-2xl italic ring-2 ring-white/60"
        >
          {initials(me.firstName, me.lastName)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DisplayTitle className="text-2xl normal-case">{me.name}</DisplayTitle>
          <p className="truncate text-sm text-white/90">{me.email}</p>
          {me.promo ? <p className="text-sm text-white/85">Promo {me.promo}</p> : null}
        </div>
      </BrandPanel>

      <Card>
        <div className="flex flex-col gap-1">
          <CardTitle>Mon identité</CardTitle>
          <CardDescription>
            Ton prénom et ton nom apparaissent sur tes billets et dans les listes du BDE.
          </CardDescription>
        </div>
        <ProfileNameForm firstName={me.firstName} lastName={me.lastName} />
      </Card>

      <Card>
        <CardTitle>Mes rôles</CardTitle>
        <ul className="flex flex-wrap gap-2">
          {me.roles.map((role) => (
            <li
              key={role}
              className="rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground text-sm"
            >
              {ROLE_LABELS[role]}
            </li>
          ))}
        </ul>
        {me.memberships.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {me.memberships.map((m) => (
              <li key={m.id}>
                {m.pole
                  ? `${MEMBERSHIP_ROLE_LABELS[m.role]} · pôle ${m.pole.name}`
                  : `Bureau${m.boardPosition ? ` · ${BOARD_POSITION_LABELS[m.boardPosition]}` : ""}`}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <NotificationsCard publicKey={push.publicKey} newEvents={push.newEvents} />

      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card shadow-primary/5 shadow-sm">
        {rows.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-4 font-semibold transition-colors hover:bg-accent"
            >
              <Icon aria-hidden className="size-5 text-primary" />
              <span className="flex-1">{label}</span>
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      <SignOutButton />
    </div>
  );
}
