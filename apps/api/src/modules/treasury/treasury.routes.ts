import {
  AttachmentUploadQuery,
  CreateTransactionInput,
  EventBudgetDto,
  ListTransactionsQuery,
  RECEIPT_TYPES,
  SetEventBudgetInput,
  TransactionDetailDto,
  TransactionDto,
  TreasurySummaryDto,
  UpdateTransactionInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { AppError, throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import type { ReceiptStore } from "../../lib/storage";
import {
  addAttachment,
  createTransaction,
  getEventBudget,
  getSummary,
  getTransaction,
  listTransactions,
  removeAttachment,
  reverseTransaction,
  setEventBudget,
  updateTransaction,
} from "./treasury.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const Binary = z.string().meta({ format: "binary" });
const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
  409: errorResponse("Écriture déjà annulée"),
  422: errorResponse("Initiateur hors du BDE, trop de justificatifs"),
};
const TxParams = z.object({ transactionId: z.uuid() });

const summaryRoute = createRoute({
  method: "get",
  path: "/treasury/summary",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  responses: { 200: json(TreasurySummaryDto, "Recettes, dépenses et solde de l'année"), ...errors },
});
const listRoute = createRoute({
  method: "get",
  path: "/treasury/transactions",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  request: { query: ListTransactionsQuery },
  responses: { 200: json(z.array(TransactionDto), "Écritures de l'année"), ...errors },
});
const getRoute = createRoute({
  method: "get",
  path: "/treasury/transactions/{transactionId}",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  request: { params: TxParams },
  responses: { 200: json(TransactionDetailDto, "Écriture et ses justificatifs"), ...errors },
});
const createTxRoute = createRoute({
  method: "post",
  path: "/treasury/transactions",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: body(CreateTransactionInput),
  responses: { 201: json(TransactionDetailDto, "Écriture enregistrée"), ...errors },
});
const updateRoute = createRoute({
  method: "patch",
  path: "/treasury/transactions/{transactionId}",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: TxParams, ...body(UpdateTransactionInput) },
  responses: { 200: json(TransactionDetailDto, "Écriture corrigée (hors montant)"), ...errors },
});
const reverseRoute = createRoute({
  method: "post",
  path: "/treasury/transactions/{transactionId}/reverse",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: TxParams },
  responses: { 201: json(TransactionDetailDto, "Écriture d'annulation"), ...errors },
});
const attachmentUploadRoute = createRoute({
  method: "post",
  path: "/treasury/transactions/{transactionId}/attachments",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: {
    params: TxParams,
    query: AttachmentUploadQuery,
    body: {
      content: Object.fromEntries(RECEIPT_TYPES.map((t) => [t, { schema: Binary }])),
      required: true,
      description: "Le fichier lui-même : photo ou PDF, 8 Mo au plus",
    },
  },
  responses: { 201: json(TransactionDetailDto, "Justificatif ajouté"), ...errors },
});
const attachmentDeleteRoute = createRoute({
  method: "delete",
  path: "/treasury/attachments/{attachmentId}",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: z.object({ attachmentId: z.uuid() }) },
  responses: { 200: json(TransactionDetailDto, "Justificatif retiré"), ...errors },
});
const attachmentFileRoute = createRoute({
  method: "get",
  path: "/treasury/attachments/{name}",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  request: { params: z.object({ name: z.string().max(64) }) },
  responses: {
    200: {
      content: Object.fromEntries(RECEIPT_TYPES.map((t) => [t, { schema: Binary }])),
      description: "Justificatif",
    },
    ...errors,
  },
});
const eventBudgetRoute = createRoute({
  method: "get",
  path: "/events/{eventId}/budget",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  request: { params: z.object({ eventId: z.uuid() }) },
  responses: { 200: json(EventBudgetDto, "Budget prévu et réalisé"), ...errors },
});
const budgetRoute = createRoute({
  method: "put",
  path: "/events/{eventId}/budget",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: z.object({ eventId: z.uuid() }), ...body(SetEventBudgetInput) },
  responses: { 200: json(SetEventBudgetInput, "Budget enregistré"), ...errors },
});

export function createTreasuryRouter(receipts: ReceiptStore) {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(summaryRoute, async (c) => c.json(await getSummary(authedCtx(c.get("ctx"))), 200))
    .openapi(listRoute, async (c) =>
      c.json(await listTransactions(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(getRoute, async (c) =>
      c.json(
        await getTransaction(authedCtx(c.get("ctx")), c.req.valid("param").transactionId),
        200,
      ),
    )
    .openapi(createTxRoute, async (c) =>
      c.json(await createTransaction(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(updateRoute, async (c) =>
      c.json(
        await updateTransaction(
          authedCtx(c.get("ctx")),
          c.req.valid("param").transactionId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(reverseRoute, async (c) =>
      c.json(
        await reverseTransaction(authedCtx(c.get("ctx")), c.req.valid("param").transactionId),
        201,
      ),
    )
    .openapi(attachmentUploadRoute, async (c) => {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      return c.json(
        await addAttachment(
          authedCtx(c.get("ctx")),
          receipts,
          c.req.valid("param").transactionId,
          c.req.valid("query").name,
          bytes,
        ),
        201,
      );
    })
    .openapi(attachmentDeleteRoute, async (c) =>
      c.json(
        await removeAttachment(
          authedCtx(c.get("ctx")),
          receipts,
          c.req.valid("param").attachmentId,
        ),
        200,
      ),
    )
    .openapi(attachmentFileRoute, async (c) => {
      const file = await receipts.read(c.req.valid("param").name);
      if (!file) throw new AppError("NOT_FOUND", 404, "Ce justificatif n'existe pas.");
      // Names are random and never reused: the file can be cached for good. Shown in the page.
      return new Response(file.bytes, {
        headers: {
          "content-type": file.type,
          "content-disposition": "inline",
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    })
    .openapi(eventBudgetRoute, async (c) =>
      c.json(await getEventBudget(authedCtx(c.get("ctx")), c.req.valid("param").eventId), 200),
    )
    .openapi(budgetRoute, async (c) =>
      c.json(
        await setEventBudget(
          authedCtx(c.get("ctx")),
          c.req.valid("param").eventId,
          c.req.valid("json").budgetCents,
        ),
        200,
      ),
    );
}
