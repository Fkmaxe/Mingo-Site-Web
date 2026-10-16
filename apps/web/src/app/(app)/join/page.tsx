import type { Metadata } from "next";
import { PageHeader } from "@/components/brand";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ApplyForm } from "@/features/applications/apply-form";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/labels";
import { MyDocuments } from "@/features/applications/my-documents";
import { getApplicationForm, getMyApplication } from "@/features/applications/queries";
import { WithdrawButton } from "@/features/applications/withdraw-button";
import { HOME } from "@/lib/breadcrumbs";
import { formatDateTime } from "@/lib/paris-time";
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
  const [application, form] = await Promise.all([getMyApplication(), getApplicationForm()]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Rejoindre le BDE" breadcrumb={[HOME]} />
      {application ? (
        <Card>
          <CardTitle>
            Candidature : {APPLICATION_STATUS_LABELS[application.status].toLowerCase()}
          </CardTitle>
          <CardDescription>{STATUS_TEXT[application.status]}</CardDescription>
          <p className="text-sm">
            {application.wishes.length > 1 ? "Pôles souhaités" : "Pôle souhaité"} :{" "}
            {application.wishes.map((w) => w.name).join(", ")}
          </p>
          {application.status === "new" ? <WithdrawButton /> : null}
        </Card>
      ) : null}
      {application ? <MyDocuments application={application} /> : null}
      {application ? null : (
        <>
          <p className="whitespace-pre-line text-muted-foreground text-sm">
            {form.intro ||
              "Communication, sport, événementiel, partenariat : dis-nous où tu veux t'investir."}
          </p>
          {form.acceptingNow ? (
            <>
              {form.closesAt ? (
                <p className="text-sm">
                  Candidatures ouvertes jusqu'au{" "}
                  <span className="font-medium">{formatDateTime(form.closesAt)}</span>.
                </p>
              ) : null}
              <ApplyForm form={form} />
            </>
          ) : (
            <Card>
              <CardTitle>Les candidatures sont fermées</CardTitle>
              <CardDescription>
                Reviens plus tard, ou suis les événements du BDE en attendant.
              </CardDescription>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
