import {
  type CreateTransactionInput as CreateTransactionBody,
  CreateTransactionInput,
  type TreasuryDirection,
  type TreasuryKind,
} from "@bde/shared";
import type { FieldErrors, ResolverResult } from "react-hook-form";
import { parseEuros } from "@/lib/money";
import type { TransactionDetail } from "./types";

/** What the form holds: text as typed, turned into the API input on submit. */
export type TransactionFormValues = {
  counterparty: string;
  initiatorUserId: string | null;
  /** Euros as typed: "12,50". */
  amount: string;
  occurredOn: string;
  kind: TreasuryKind;
  otherLabel: string;
  direction: TreasuryDirection | "";
  eventId: string;
  comment: string;
};

export function emptyTransactionForm(
  today: string,
  initiatorUserId: string | null,
): TransactionFormValues {
  return {
    counterparty: "",
    initiatorUserId,
    amount: "",
    occurredOn: today,
    kind: "debit",
    otherLabel: "",
    direction: "",
    eventId: "",
    comment: "",
  };
}

/** An existing entry, to correct it (its amount, kind and direction stay as they are). */
export function transactionToForm(t: TransactionDetail): TransactionFormValues {
  return {
    counterparty: t.counterparty,
    initiatorUserId: t.initiator?.id ?? null,
    amount: (Math.abs(t.amountCents) / 100).toFixed(2).replace(".", ","),
    occurredOn: t.occurredOn,
    kind: t.kind,
    otherLabel: t.otherLabel ?? "",
    direction: t.amountCents < 0 ? "out" : "in",
    eventId: t.event?.id ?? "",
    comment: t.comment,
  };
}

/** The API input; an amount that is not a number of euros becomes NaN and is refused. */
export function formToInput(values: TransactionFormValues): CreateTransactionBody {
  const other = values.kind === "other";
  return {
    counterparty: values.counterparty,
    initiatorUserId: values.initiatorUserId ?? "",
    amountCents: parseEuros(values.amount) ?? Number.NaN,
    occurredOn: values.occurredOn,
    kind: values.kind,
    otherLabel: other ? values.otherLabel.trim() || null : null,
    direction: other && values.direction ? values.direction : null,
    eventId: values.eventId || null,
    comment: values.comment,
  };
}

const FIELD_OF: Partial<Record<string, keyof TransactionFormValues>> = {
  amountCents: "amount",
};

/** react-hook-form resolver validating with the shared API schema (same rules and messages). */
export function transactionFormResolver(
  values: TransactionFormValues,
): ResolverResult<TransactionFormValues> {
  const result = CreateTransactionInput.safeParse(formToInput(values));
  if (result.success) return { values, errors: {} };
  const errors: FieldErrors<TransactionFormValues> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    const field = FIELD_OF[key] ?? (key as keyof TransactionFormValues);
    if (field && !errors[field]) {
      errors[field] = {
        type: issue.code,
        message: field === "amount" && !values.amount.trim() ? "Indique le montant" : issue.message,
      };
    }
  }
  if (errors.amount && parseEuros(values.amount) === null && values.amount.trim()) {
    errors.amount = { type: "custom", message: "Montant invalide : 12,50 par exemple" };
  }
  // Zod skips the « other » refinement while another field is invalid: report it at once.
  if (values.kind === "other") {
    if (!values.otherLabel.trim() && !errors.otherLabel) {
      errors.otherLabel = { type: "custom", message: "Précise le type d'opération" };
    }
    if (!values.direction && !errors.direction) {
      errors.direction = { type: "custom", message: "Indique si l'argent entre ou sort" };
    }
  }
  return { values: {}, errors };
}
