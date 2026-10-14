import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import {
  getTransactionOr404,
  listInitiators,
  listTreasuryEvents,
} from "@/features/treasury/queries";
import { TransactionForm } from "@/features/treasury/transaction-form";
import { transactionToForm } from "@/features/treasury/transaction-form-values";
import { manageTrail, TREASURY } from "@/lib/breadcrumbs";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Modifier l'écriture" };

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const me = await requireMe();
  if (!me.permissions.includes("budget:manage")) notFound();
  const [t, initiators, events] = await Promise.all([
    params.then(({ transactionId }) => getTransactionOr404(transactionId)),
    listInitiators(),
    listTreasuryEvents(),
  ]);
  // The current event stays selectable even when it is not one of the user's.
  const options =
    t.event && !events.some((e) => e.id === t.event?.id)
      ? [...events, { id: t.event.id, title: t.event.title }]
      : events;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Modifier"
        description="Les justificatifs se gèrent depuis la page de l'écriture."
        breadcrumb={manageTrail(TREASURY, {
          label: t.counterparty,
          href: `/manage/treasury/${t.id}`,
        })}
      />
      <TransactionForm
        initiators={initiators}
        events={options}
        defaultValues={transactionToForm(t)}
        edit={{ transactionId: t.id, amountCents: t.amountCents }}
      />
    </div>
  );
}
