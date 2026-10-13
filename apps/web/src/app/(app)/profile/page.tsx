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
import { MyLeagueCard } from "@/features/league/my-league";
import { getMyLeague } from "@/features/league/queries";
import { AvatarEditor } from "@/features/profile/avatar-editor";
import { ClassForm } from "@/features/profile/class-form";
import { PasskeysCard } from "@/features/profile/passkeys-card";
import { ProfileNameForm } from "@/features/profile/profile-name-form";
import { listClasses, listPasskeys } from "@/features/profile/queries";
import { NotificationsCard } from "@/features/push/notifications-card";
import { getPushSetup } from "@/features/push/queries";
import { BOARD_POSITION_LABELS, MEMBERSHIP_ROLE_LABELS, ROLE_LABELS } from "@/lib/labels";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Profil" };

type Row = { href: string; label: string; icon: LucideIcon };

export default async function ProfilePage() {
  const [me, push, classes, passkeys, league] = await Promise.all([
    requireMe(),
    getPushSetup(),
    listClasses(),
    listPasskeys(),
    getMyLeague(),
  ]);
  const rows: Row[] = me.roles.includes("member")
    ? [
        { href: "/grades", label: "Ma note et mes présences", icon: GraduationCap },
        { href: "/tasks", label: "Mes tâches", icon: ClipboardList },
      ]
    : [{ href: "/points", label: "Mes points open", icon: Sparkles }];
  return (
    <div className="flex flex-col gap-6">
      <BrandPanel className="flex items-center gap-4">
        <AvatarEditor name={me.name} url={me.avatarUrl} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <DisplayTitle className="text-2xl normal-case">{me.name}</DisplayTitle>
          <p className="truncate text-sm text-white/90">{me.email}</p>
          {me.promo ? <p className="text-sm text-white/85">{me.promo}</p> : null}
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

      <Card id="classe">
        <div className="flex flex-col gap-1">
          <CardTitle>Ma classe</CardTitle>
          <CardDescription>
            Ton année, ta filière et ton rythme apparaissent dans les listes d'inscrits et le
            classement de la ligue.
          </CardDescription>
        </div>
        <ClassForm
          levels={classes.levels}
          tracks={classes.tracks}
          levelId={me.level?.id ?? null}
          trackId={me.track?.id ?? null}
          rhythm={me.rhythm}
          classNumber={me.classNumber}
          januaryIntake={me.januaryIntake}
        />
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

      <MyLeagueCard league={league} />

      <PasskeysCard passkeys={passkeys} />

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
