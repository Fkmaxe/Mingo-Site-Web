import { z } from "zod";
import { TREASURY_DIRECTIONS, TREASURY_KINDS, type TreasuryKind } from "../enums";

export const TREASURY_KIND_LABELS: Record<TreasuryKind, string> = {
  debit: "Débit (sortie)",
  credit: "Crédit (entrée)",
  other: "Autre",
};

/** Payment receipts: photos (resized by the browser) or PDF, 8 MB at most, 10 per entry. */
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export const RECEIPTS_PER_TRANSACTION = 10;

const Counterparty = z
  .string()
  .trim()
  .min(1, "Le nom de la contrepartie est obligatoire")
  .max(200, "Nom trop long");
const OtherLabel = z.string().trim().max(60, "60 caractères maximum");
const Comment = z.string().trim().max(2000, "Commentaire trop long");

export const CreateTransactionInput = z
  .object({
    counterparty: Counterparty,
    /** BDE member of the year behind the operation. */
    initiatorUserId: z.uuid("Choisis l'initiateur"),
    /** Total amount in cents, always positive: the kind (and the direction of « other ») gives the sign. */
    amountCents: z
      .int("Montant invalide (en centimes)")
      .min(1, "Le montant doit être positif")
      .max(10_000_000, "Montant trop grand (100 000 € max)"),
    occurredOn: z.iso.date("Date invalide"),
    kind: z.enum(TREASURY_KINDS, "Type invalide"),
    /** Name of an « other » entry. */
    otherLabel: OtherLabel.nullable().default(null),
    /** Money in or out, for an « other » entry. */
    direction: z
      .enum(TREASURY_DIRECTIONS, "Indique si l'argent entre ou sort")
      .nullable()
      .default(null),
    eventId: z.uuid("Événement invalide").nullable().default(null),
    comment: Comment.default(""),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "other") return;
    if (!v.otherLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["otherLabel"],
        message: "Précise le type d'opération",
      });
    }
    if (!v.direction) {
      ctx.addIssue({
        code: "custom",
        path: ["direction"],
        message: "Indique si l'argent entre ou sort",
      });
    }
  })
  .meta({ id: "CreateTransactionInput" });
export type CreateTransactionInput = z.input<typeof CreateTransactionInput>;
export type CreateTransactionData = z.output<typeof CreateTransactionInput>;

/**
 * The amount, the kind and the direction never change (ledger): a mistake is cancelled with a
 * reversal. The rest can be corrected; the name of an « other » entry only on such an entry.
 */
export const UpdateTransactionInput = z
  .object({
    counterparty: Counterparty,
    initiatorUserId: z.uuid("Choisis l'initiateur"),
    occurredOn: z.iso.date("Date invalide"),
    otherLabel: OtherLabel.min(1, "Précise le type d'opération"),
    eventId: z.uuid("Événement invalide").nullable(),
    comment: Comment,
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
    counterparty: z.string(),
    /** Null on entries recorded before initiators existed, or whose account was deleted. */
    initiator: z
      .object({ id: z.uuid(), name: z.string(), avatarUrl: z.string().nullable() })
      .nullable(),
    /** Signed: positive money in, negative money out. */
    amountCents: z.int(),
    occurredOn: z.string(),
    kind: z.enum(TREASURY_KINDS),
    /** Name of an « other » entry. */
    otherLabel: z.string().nullable(),
    comment: z.string(),
    event: EventRef.nullable(),
    /** Link to a receipt, from before receipts were uploaded. */
    receiptUrl: z.string().nullable(),
    attachmentCount: z.int(),
    createdBy: z.string().nullable(),
    /** Set on the reversal entry: the entry it cancels. */
    reversalOfId: z.uuid().nullable(),
    /** Set on a cancelled entry: its reversal. */
    reversedById: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Transaction" });
export type TransactionDto = z.infer<typeof TransactionDto>;

export const AttachmentDto = z
  .object({
    id: z.uuid(),
    /** Name of the file as uploaded. */
    name: z.string(),
    contentType: z.enum(RECEIPT_TYPES),
    sizeBytes: z.int(),
    /** Path on the web origin (the web relays the file). */
    url: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "TreasuryAttachment" });
export type AttachmentDto = z.infer<typeof AttachmentDto>;

export const TransactionDetailDto = TransactionDto.extend({
  attachments: z.array(AttachmentDto),
}).meta({ id: "TransactionDetail" });
export type TransactionDetailDto = z.infer<typeof TransactionDetailDto>;

export const ListTransactionsQuery = z.object({
  /** Searches the counterparty, the initiator, the « other » name and the comment. */
  q: z.string().trim().max(100).optional(),
  kind: z.enum(TREASURY_KINDS).optional(),
  eventId: z.uuid().optional(),
});

export const AttachmentUploadQuery = z.object({
  /** Original file name, shown in the entry. */
  name: z.string().trim().min(1).max(200),
});

export const TreasurySummaryDto = z
  .object({
    schoolYear: z.string(),
    incomeCents: z.int(),
    expenseCents: z.int(),
    balanceCents: z.int(),
  })
  .meta({ id: "TreasurySummary" });
export type TreasurySummaryDto = z.infer<typeof TreasurySummaryDto>;

/** Planned budget of an event against its entries. */
export const EventBudgetDto = z
  .object({
    budgetCents: z.int().nullable(),
    incomeCents: z.int(),
    expenseCents: z.int(),
    balanceCents: z.int(),
  })
  .meta({ id: "EventBudget" });
export type EventBudgetDto = z.infer<typeof EventBudgetDto>;
