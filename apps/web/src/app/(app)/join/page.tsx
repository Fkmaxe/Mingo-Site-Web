import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ApplyForm } from "@/features/applications/apply-form";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/labels";
import { getMyApplication } from "@/features/applications/queries";
import { WithdrawButton } from "@/features/applications/withdraw-button";
import { listPoles } from "@/features/events/queries";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Rejoindre le BDE" };

const STATUS_TEXT = {
  new: "Ta candidature est bien reçue : le pôle va la regarder.",
  interview: "Le BDE souhaite te rencontrer : surveille tes messages.",
  accepted: "Bienvenue dans le BDE !",
  rejected: "Ta candidature n'a pas été retenue cette année. Merci d'avoir tenté !",
} as const;

export default async function JoinPage() {
  const me = await requireMe();
  if (me.roles.includes("member")) {
    return (
      <Card>
        <CardTitle>Tu fais déjà partie du BDE</CardTitle>
        <CardDescription>
          Retrouve tes tâches, réunions et créneaux staff dans l'appli.
        </CardDescription>
      </Card>
    );
  }
  const [application, poles] = await Promise.all([getMyApplication(), listPoles()]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-extrabold text-[1.75rem] uppercase italic leading-none tracking-tight">
        Rejoindre le BDE
      </h1>
      {application ? (
        <Card>
          <CardTitle>
            Candidature : {APPLICATION_STATUS_LABELS[application.status].toLowerCase()}
          </CardTitle>
          <CardDescription>{STATUS_TEXT[application.status]}</CardDescription>
          <p className="text-sm">Pôle souhaité : {application.wishedPole.name}</p>
          {application.status === "new" ? <WithdrawButton /> : null}
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Communication, sport, événementiel, partenariat : dis-nous où tu veux t'investir.
          </p>
          <ApplyForm poles={poles} />
        </>
      )}
    </div>
  );
}
