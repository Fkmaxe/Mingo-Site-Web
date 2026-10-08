import type { Metadata } from "next";
import { Card, CardDescription } from "@/components/ui/card";
import { formatPoints } from "@/features/open-points/labels";
import { MovementList } from "@/features/open-points/movement-list";
import { getMyOpenPoints } from "@/features/open-points/queries";

export const metadata: Metadata = { title: "Mes points open" };

export default async function PointsPage() {
  const points = await getMyOpenPoints();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
        Mes points open
      </h1>
      {points.isMember ? (
        <Card>
          <CardDescription>
            Tu es membre du BDE cette année : les membres n'ont pas de points open, ils reçoivent
            une note du bureau.
          </CardDescription>
        </Card>
      ) : (
        <>
          <Card className="items-center gap-1 text-center">
            <span className="text-muted-foreground text-sm">
              Solde {points.schoolYear ? points.schoolYear.label : ""}
            </span>
            <span className="font-bold text-4xl text-primary tabular-nums">
              {formatPoints(points.balance)}
            </span>
            {points.pending !== 0 ? (
              <span className="text-muted-foreground text-sm">
                + {formatPoints(points.pending)} en attente de validation par le bureau
              </span>
            ) : null}
          </Card>
          <section className="flex flex-col gap-3">
            <h2 className="font-bold font-display text-lg">Historique</h2>
            <MovementList movements={points.movements} />
          </section>
        </>
      )}
    </div>
  );
}
