import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditList } from "@/features/admin/audit-list";
import { MembersAdmin } from "@/features/admin/members-admin";
import { PolesAdmin } from "@/features/admin/poles-admin";
import {
  listAdminUsers,
  listAudit,
  listSchoolYears,
  type UserScope,
} from "@/features/admin/queries";
import { YearsAdmin } from "@/features/admin/years-admin";
import { listPoles } from "@/features/events/queries";
import { requireMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Administration" };

const TABS = [
  ["members", "Membres", "roles:manage"],
  ["poles", "Pôles", "settings:manage"],
  ["years", "Années", "settings:manage"],
  ["audit", "Journal", "audit:read"],
] as const;
type Tab = (typeof TABS)[number][0];

const SCOPES = [
  ["all", "Tous les comptes"],
  ["roles", "Avec un rôle"],
  ["unverified", "Non confirmés"],
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; cursor?: string; scope?: string }>;
}) {
  const [me, params] = await Promise.all([requireMe(), searchParams]);
  const allowed = TABS.filter(([, , permission]) => me.permissions.includes(permission));
  const first = allowed[0];
  if (!first) notFound();
  const tab: Tab = allowed.find(([value]) => value === params.tab)?.[0] ?? first[0];
  const q = params.q?.trim() || undefined;
  const scope: UserScope =
    params.scope === "roles" || params.scope === "unverified" ? params.scope : "all";

  const [users, poles, years, audit] = await Promise.all([
    tab === "members" ? listAdminUsers(q, scope) : null,
    tab === "members" || tab === "poles" ? listPoles() : null,
    tab === "years" ? listSchoolYears() : null,
    tab === "audit" ? listAudit(params.cursor) : null,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Administration" description="Rôles, pôles, années scolaires et journal." />
      <nav
        aria-label="Sections"
        className="grid rounded-full bg-muted p-1 text-sm"
        style={{ gridTemplateColumns: `repeat(${allowed.length}, minmax(0, 1fr))` }}
      >
        {allowed.map(([value, label]) => (
          <Link
            key={value}
            href={`/manage/admin?tab=${value}`}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-center rounded-full font-semibold",
              tab === value ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {users && poles ? (
        <>
          <form action="/manage/admin" className="flex gap-2">
            <input type="hidden" name="tab" value="members" />
            <input type="hidden" name="scope" value={scope} />
            <label htmlFor="admin-search" className="sr-only">
              Rechercher un compte
            </label>
            <Input
              id="admin-search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nom ou adresse mail"
              autoComplete="off"
            />
            <Button type="submit" size="icon" aria-label="Rechercher">
              <Search aria-hidden />
            </Button>
          </form>
          <nav aria-label="Filtre" className="flex flex-wrap gap-2">
            {SCOPES.map(([value, label]) => (
              <Link
                key={value}
                href={`/manage/admin?tab=members&scope=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                aria-current={scope === value ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-full border px-3 font-semibold text-sm",
                  scope === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-muted-foreground text-xs">
            {users.total} compte{users.total > 1 ? "s" : ""}
            {q ? ` pour « ${q} »` : ""}
            {users.total > users.items.length
              ? ` · les ${users.items.length} plus récents affichés, cherche par nom pour les autres`
              : ""}
            . Un compte « non confirmé » n'a pas encore cliqué le lien du mail : il ne peut pas se
            connecter.
          </p>
          <MembersAdmin users={users.items} poles={poles} meId={me.id} />
        </>
      ) : null}
      {tab === "poles" && poles ? <PolesAdmin poles={poles} /> : null}
      {years ? <YearsAdmin years={years} /> : null}
      {audit ? (
        <>
          <AuditList entries={audit.items} />
          {audit.nextCursor ? (
            <Button asChild variant="outline">
              <Link href={`/manage/admin?tab=audit&cursor=${encodeURIComponent(audit.nextCursor)}`}>
                Plus ancien
              </Link>
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
