import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription } from "@/components/ui/card";
import { listDirectory } from "@/features/members/queries";
import type { DirectoryEntry } from "@/features/members/types";
import { BOARD_POSITION_LABELS, MEMBERSHIP_ROLE_LABELS } from "@/lib/labels";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "L'équipe" };

export default async function TeamPage() {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <Card>
        <CardDescription>L'annuaire est réservé aux membres du BDE.</CardDescription>
      </Card>
    );
  }
  const entries = await listDirectory();
  const groups = new Map<string, DirectoryEntry[]>();
  for (const e of entries) {
    const key = e.pole?.name ?? "Bureau";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">L'équipe</h1>
        <Link
          href="/team/partners"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Partenaires
        </Link>
      </div>
      {[...groups.entries()].map(([name, people]) => (
        <section key={name} className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg">{name === "Bureau" ? name : `Pôle ${name}`}</h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {people.map((e) => (
              <li
                key={e.membershipId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{e.user.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {e.boardPosition
                      ? BOARD_POSITION_LABELS[e.boardPosition]
                      : MEMBERSHIP_ROLE_LABELS[e.role]}
                    {e.user.promo ? ` · ${e.user.promo}` : ""}
                  </span>
                </span>
                <a
                  href={`mailto:${e.user.email}`}
                  aria-label={`Écrire à ${e.user.name}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-primary hover:bg-accent"
                >
                  <Mail aria-hidden className="size-5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
