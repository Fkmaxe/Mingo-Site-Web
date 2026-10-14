import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand";
import { listInitiators, listTreasuryEvents } from "@/features/treasury/queries";
import { TransactionForm } from "@/features/treasury/transaction-form";
import { emptyTransactionForm } from "@/features/treasury/transaction-form-values";
import { manageTrail, TREASURY } from "@/lib/breadcrumbs";
import { parisToday } from "@/lib/paris-time";
import { requireMe } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvelle écriture" };

export default async function NewTransactionPage() {
  const me = await requireMe();
  if (!me.permissions.includes("budget:manage")) notFound();
  const [initiators, events] = await Promise.all([listInitiators(), listTreasuryEvents()]);
  // The treasurer usually records what they paid themselves.
  const initiator = initiators.some((i) => i.id === me.id) ? me.id : null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Nouvelle écriture"
        description="Dépense, recette ou autre opération, avec ses justificatifs."
        breadcrumb={manageTrail(TREASURY)}
      />
      <TransactionForm
        initiators={initiators}
        events={events}
        defaultValues={emptyTransactionForm(parisToday(), initiator)}
      />
    </div>
  );
}
