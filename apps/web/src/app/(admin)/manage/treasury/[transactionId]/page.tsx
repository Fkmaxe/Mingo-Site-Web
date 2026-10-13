import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { DisplayTitle } from "@/components/brand";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Attachments } from "@/features/treasury/attachments";
import { getTransactionOr404 } from "@/features/treasury/queries";
import { ReverseButton } from "@/features/treasury/reverse-button";
import { Amount, kindLabel } from "@/features/treasury/transaction-list";
import { manageTrail, TREASURY } from "@/lib/breadcrumbs";
import { formatShortDay } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Écriture" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="shrink-0 text-muted-foreground text-xs sm:w-40">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const me = await requireMe();
  if (!me.permissions.includes("budget:read")) notFound();
  const t = await getTransactionOr404((await params).transactionId);
  const canManage = me.permissions.includes("budget:manage");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={manageTrail(TREASURY)} current={t.counterparty} />
        <span className="font-medium text-muted-foreground text-sm">{kindLabel(t)}</span>
        <DisplayTitle className="text-2xl normal-case">{t.counterparty}</DisplayTitle>
        <Amount cents={t.amountCents} className="text-2xl" />
        {t.reversedById ? (
          <p className="text-sm">
            Écriture annulée :{" "}
            <Link
              href={`/manage/treasury/${t.reversedById}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              voir l'annulation
            </Link>
          </p>
        ) : null}
        {t.reversalOfId ? (
          <p className="text-sm">
            Annule{" "}
            <Link
              href={`/manage/treasury/${t.reversalOfId}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              l'écriture d'origine
            </Link>
          </p>
        ) : null}
      </div>

      <Card className="p-4">
        <dl className="flex flex-col gap-3">
          <Row label="Initiateur">
            {t.initiator ? (
              <span className="flex items-center gap-2">
                <Avatar name={t.initiator.name} url={t.initiator.avatarUrl} size={28} />
                {t.initiator.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Non renseigné</span>
            )}
          </Row>
          <Row label="Date de l'opération">
            <span className="first-letter:uppercase">
              {formatShortDay(`${t.occurredOn}T12:00:00Z`)}
            </span>
          </Row>
          <Row label="Type de transaction">{kindLabel(t)}</Row>
          {t.event ? (
            <Row label="Événement">
              <Link
                href={`/manage/events/${t.event.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {t.event.title}
              </Link>
            </Row>
          ) : null}
          <Row label="Commentaire">
            {t.comment ? (
              <span className="whitespace-pre-line">{t.comment}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>
          <Row label="Saisie">
            <span className="text-muted-foreground">
              {t.createdBy ?? "Compte supprimé"}, le {formatShortDay(t.createdAt)}
            </span>
          </Row>
        </dl>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-display text-lg">Justificatifs de paiement</h2>
        <Attachments
          transactionId={t.id}
          attachments={t.attachments}
          receiptUrl={t.receiptUrl}
          canManage={canManage}
        />
      </section>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/manage/treasury/${t.id}/edit`}>
              <Pencil aria-hidden />
              Modifier
            </Link>
          </Button>
          {t.reversedById || t.reversalOfId ? null : <ReverseButton transactionId={t.id} />}
        </div>
      ) : null}
    </div>
  );
}
