import { z } from "zod";

const Cents = z.int("Montant invalide (en centimes)");

export const CreateTransactionInput = z
  .object({
    eventId: z.uuid("Événement invalide").nullable().default(null),
    label: z.string().trim().min(1, "Le libellé est obligatoire").max(200, "Libellé trop long"),
    /** Signed: positive for an income, negative for an expense. Never zero. */
    amountCents: Cents.refine((n) => n !== 0, "Le montant ne peut pas être nul").refine(
      (n) => Math.abs(n) <= 10_000_000,
      "Montant trop grand (100 000 € max)",
    ),
    occurredOn: z.iso.date("Date invalide"),
    receiptUrl: z.url("Lien de justificatif invalide").nullable().default(null),
  })
  .meta({ id: "CreateTransactionInput" });
export type CreateTransactionInput = z.input<typeof CreateTransactionInput>;
export type CreateTransactionData = z.output<typeof CreateTransactionInput>;

/** The amount never changes: a mistake is corrected with a reversal (ledger). */
export const UpdateTransactionInput = z
  .object({
    label: CreateTransactionInput.shape.label,
    occurredOn: CreateTransactionInput.shape.occurredOn,
    receiptUrl: z.url("Lien de justificatif invalide").nullable(),
  })
  .partial()
  .meta({ id: "UpdateTransactionInput" });
export type UpdateTransactionData = z.output<typeof UpdateTransactionInput>;

export const SetEventBudgetInput = z
  .object({
    budgetCents: z.int("Budget invalide").min(0, "Le budget ne peut pas être négatif").nullable(),
  })
  .meta({ id: "SetEventBudgetInput" });

const EventRef = z.object({ id: z.uuid(), title: z.string(), slug: z.string() });

export const TransactionDto = z
  .object({
    id: z.uuid(),
    label: z.string(),
    amountCents: z.int(),
    occurredOn: z.string(),
    receiptUrl: z.string().nullable(),
    event: EventRef.nullable(),
    createdBy: z.string().nullable(),
    /** Set on the reversal entry: the entry it cancels. */
    reversalOfId: z.uuid().nullable(),
    /** Set on a cancelled entry: its reversal. */
    reversedById: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Transaction" });
export type TransactionDto = z.infer<typeof TransactionDto>;

export const ListTransactionsQuery = z.object({ eventId: z.uuid().optional() });

export const TreasurySummaryDto = z
  .object({
    schoolYear: z.string(),
    incomeCents: z.int(),
    expenseCents: z.int(),
    balanceCents: z.int(),
    events: z.array(
      z.object({
        event: EventRef.extend({ startsAt: z.iso.datetime() }),
        budgetCents: z.int().nullable(),
        incomeCents: z.int(),
        expenseCents: z.int(),
        balanceCents: z.int(),
      }),
    ),
  })
  .meta({ id: "TreasurySummary" });
export type TreasurySummaryDto = z.infer<typeof TreasurySummaryDto>;
