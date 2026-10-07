import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { BOARD_POSITION_LABELS, MEMBERSHIP_ROLE_LABELS, ROLE_LABELS } from "@/lib/labels";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const me = await requireMe();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">{me.name}</h1>
        <p className="break-all text-muted-foreground">{me.email}</p>
        {me.promo ? <p className="text-muted-foreground text-sm">Promo {me.promo}</p> : null}
      </div>

      <Card>
        <CardTitle>Mes rôles</CardTitle>
        <ul className="flex flex-wrap gap-2">
          {me.roles.map((role) => (
            <li
              key={role}
              className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground text-sm"
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

      {me.roles.includes("member") ? (
        <Link href="/grades" className="text-primary underline-offset-4 hover:underline">
          Ma note et mes présences
        </Link>
      ) : (
        <Link href="/points" className="text-primary underline-offset-4 hover:underline">
          Mes points open
        </Link>
      )}

      <SignOutButton />
    </div>
  );
}
