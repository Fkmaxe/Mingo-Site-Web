"use client";

import {
  CreateTransactionInput,
  TREASURY_DIRECTIONS,
  TREASURY_KIND_LABELS,
  TREASURY_KINDS,
  type TreasuryDirection,
} from "@bde/shared";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, type FieldPath, useForm } from "react-hook-form";
import { FieldShell, FormAlert, FormField } from "@/components/form-field";
import { MemberCombobox } from "@/components/member-combobox";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createTransactionAction, updateTransactionAction } from "./actions";
import { type PendingReceipt, ReceiptPicker, uploadReceipts } from "./receipt-picker";
import {
  formToInput,
  type TransactionFormValues,
  transactionFormResolver,
} from "./transaction-form-values";
import type { Initiator } from "./types";

const DIRECTION_LABELS: Record<TreasuryDirection, string> = {
  in: "Entrée d'argent",
  out: "Sortie d'argent",
};

type Props = {
  initiators: Initiator[];
  events: { id: string; title: string }[];
  defaultValues: TransactionFormValues;
  /** Absent: creation. When set, the amount, the kind and the direction are locked (ledger). */
  edit?: { transactionId: string; amountCents: number };
};

/**
 * New treasury entry (with its receipts) or correction of one. The amount is typed positive:
 * the kind (and the direction of « Autre ») gives the sign.
 */
export function TransactionForm({ initiators, events, defaultValues, edit }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [partial, setPartial] = useState<{ id: string; errors: string[] } | null>(null);
  const [receipts, setReceipts] = useState<PendingReceipt[]>([]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({ defaultValues, resolver: transactionFormResolver });
  const kind = watch("kind");

  const fail = (result: { message: string; fieldErrors: Record<string, string> }) => {
    setMessage(result.message);
    for (const [field, text] of Object.entries(result.fieldErrors)) {
      const key = field === "amountCents" ? "amount" : field;
      if (key in defaultValues)
        setError(key as FieldPath<TransactionFormValues>, { message: text });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    // Already validated by the resolver: parsing applies defaults and narrows the types.
    const input = CreateTransactionInput.parse(formToInput(values));
    if (edit) {
      const result = await updateTransactionAction(edit.transactionId, {
        counterparty: input.counterparty,
        // Unchanged, it is not checked again (the initiator may have left the BDE since).
        ...(input.initiatorUserId === defaultValues.initiatorUserId
          ? {}
          : { initiatorUserId: input.initiatorUserId }),
        occurredOn: input.occurredOn,
        ...(input.kind === "other" && input.otherLabel ? { otherLabel: input.otherLabel } : {}),
        eventId: input.eventId,
        comment: input.comment,
      });
      if (!result.ok) return fail(result);
      router.push(`/manage/treasury/${edit.transactionId}`);
      return;
    }
    const result = await createTransactionAction(input);
    if (!result.ok) return fail(result);
    if (!result.id) return setMessage("Erreur inattendue.");
    const failed = await uploadReceipts(result.id, receipts);
    if (failed.length > 0) {
      setPartial({ id: result.id, errors: failed });
      return;
    }
    router.push(`/manage/treasury/${result.id}`);
  });

  if (partial) {
    return (
      <div className="flex flex-col gap-3">
        <FormAlert tone="error">
          {`Écriture enregistrée, mais des justificatifs n'ont pas été envoyés : ${partial.errors.join(" ; ")}`}
        </FormAlert>
        <Button asChild className="self-start">
          <Link href={`/manage/treasury/${partial.id}`}>Ouvrir l'écriture</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}

      <FormField
        id="counterparty"
        label="Nom de la contrepartie"
        placeholder="Metro, ESGI, Red Bull…"
        autoComplete="off"
        maxLength={200}
        error={errors.counterparty?.message}
        {...register("counterparty")}
      />

      <Controller
        control={control}
        name="initiatorUserId"
        render={({ field }) => (
          <MemberCombobox
            id="initiatorUserId"
            label="Initiateur"
            hint="Le membre du BDE à l'origine de l'opération."
            members={initiators}
            value={field.value}
            onChange={field.onChange}
            error={errors.initiatorUserId?.message}
          />
        )}
      />

      {edit ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed p-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Lock aria-hidden className="size-4 text-muted-foreground" />
            {TREASURY_KIND_LABELS[kind]} · {formatCents(edit.amountCents)}
          </span>
          <span className="text-muted-foreground text-xs">
            Le montant et le sens ne se modifient pas : annule l'écriture et saisis-en une autre en
            cas d'erreur.
          </span>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="amount"
              label="Montant total (€)"
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              error={errors.amount?.message}
              {...register("amount")}
            />
            <FormField
              id="occurredOn"
              label="Date de l'opération"
              type="date"
              error={errors.occurredOn?.message}
              {...register("occurredOn")}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-sm">Type de transaction</legend>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1 text-sm">
              {TREASURY_KINDS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 text-center font-semibold leading-tight has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                    kind === value ? "bg-card shadow-sm" : "text-muted-foreground",
                  )}
                >
                  <input type="radio" value={value} className="sr-only" {...register("kind")} />
                  {TREASURY_KIND_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {kind === "other" ? (
        <div className="flex flex-col gap-4 rounded-2xl border p-3">
          <FormField
            id="otherLabel"
            label="Précise le type"
            placeholder="Virement interne, remboursement…"
            maxLength={60}
            autoComplete="off"
            error={errors.otherLabel?.message}
            {...register("otherLabel")}
          />
          {edit ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium text-sm">Sens</legend>
              <div className="grid grid-cols-2 gap-2">
                {TREASURY_DIRECTIONS.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm has-checked:border-primary has-checked:bg-primary/6"
                  >
                    <input
                      type="radio"
                      value={value}
                      className="size-4 accent-primary"
                      {...register("direction")}
                    />
                    {DIRECTION_LABELS[value]}
                  </label>
                ))}
              </div>
              {errors.direction?.message ? (
                <p className="text-destructive text-sm">{errors.direction.message}</p>
              ) : null}
            </fieldset>
          )}
        </div>
      ) : null}

      {edit ? (
        <FormField
          id="occurredOn"
          label="Date de l'opération"
          type="date"
          error={errors.occurredOn?.message}
          {...register("occurredOn")}
        />
      ) : null}

      <FieldShell id="eventId" label="Événement (facultatif)" error={errors.eventId?.message}>
        {(aria) => (
          <NativeSelect {...aria} {...register("eventId")}>
            <option value="">Aucun</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </NativeSelect>
        )}
      </FieldShell>

      {edit ? null : (
        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">Justificatifs de paiement</span>
          <ReceiptPicker receipts={receipts} onChange={setReceipts} />
        </div>
      )}

      <FieldShell id="comment" label="Commentaire (facultatif)" error={errors.comment?.message}>
        {(aria) => <Textarea {...aria} rows={3} maxLength={2000} {...register("comment")} />}
      </FieldShell>

      <div className="sticky bottom-20 rounded-2xl bg-background/90 py-2 backdrop-blur md:bottom-4">
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement…" : edit ? "Enregistrer les corrections" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
