import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatScore } from "@/features/grades/labels";
import { getMyGrades } from "@/features/grades/queries";
import { formatShortDay } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Ma note" };

export default async function MyGradesPage() {
  const me = await requireMe();
  if (!me.roles.includes("member")) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
          Ma note
        </h1>
        <Card>
          <CardDescription>La note concerne les membres du BDE.</CardDescription>
        </Card>
      </div>
    );
  }
  const { periods } = await getMyGrades();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
        Ma note
      </h1>
      {periods.length === 0 ? (
        <p className="text-muted-foreground text-sm">Le bureau n'a pas encore créé de période.</p>
      ) : null}
      {periods.map(({ period, presences, presencePoints, grade }) => (
        <Card key={period.id}>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>{period.label}</CardTitle>
            {grade ? (
              <span className="font-bold text-2xl text-primary tabular-nums">
                {formatScore(grade.finalScore)}/{period.scaleMax}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">Pas encore publiée</span>
            )}
          </div>
          {grade ? (
            <p className="text-sm">
              Présence {formatScore(presencePoints)} + pôle {formatScore(grade.involvementPoints)}
              {grade.comment ? ` · « ${grade.comment} »` : ""}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">
              Mes présences ({presences.length}) · {formatScore(presencePoints)} pt
              {presencePoints > 1 ? "s" : ""}
            </span>
            {presences.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune présence pointée.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {presences.map((p) => (
                  <li key={`${p.kind}-${p.id}`} className="flex justify-between gap-3">
                    <span>
                      {p.kind === "meeting" ? "Réunion · " : ""}
                      {p.title}{" "}
                      <span className="text-muted-foreground text-xs first-letter:uppercase">
                        {formatShortDay(p.startsAt)}
                      </span>
                    </span>
                    <span className="tabular-nums">+{formatScore(p.points)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
