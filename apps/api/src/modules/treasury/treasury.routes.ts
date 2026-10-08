import {
  CreateTransactionInput,
  ListTransactionsQuery,
  SetEventBudgetInput,
  TransactionDto,
  TreasurySummaryDto,
  UpdateTransactionInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createTransaction,
  getSummary,
  listTransactions,
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
const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
  409: errorResponse("Écriture déjà annulée"),
};
const TxParams = z.object({ transactionId: z.uuid() });

const summaryRoute = createRoute({
  method: "get",
  path: "/treasury/summary",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  responses: { 200: json(TreasurySummaryDto, "Totaux de l'année et par événement"), ...errors },
});
const listRoute = createRoute({
  method: "get",
  path: "/treasury/transactions",
  tags: ["treasury"],
  middleware: [requirePermission("budget:read")] as const,
  request: { query: ListTransactionsQuery },
  responses: { 200: json(z.array(TransactionDto), "Écritures de l'année"), ...errors },
});
const createTxRoute = createRoute({
  method: "post",
  path: "/treasury/transactions",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: body(CreateTransactionInput),
  responses: { 201: json(TransactionDto, "Écriture enregistrée"), ...errors },
});
const updateRoute = createRoute({
  method: "patch",
  path: "/treasury/transactions/{transactionId}",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: TxParams, ...body(UpdateTransactionInput) },
  responses: { 200: json(TransactionDto, "Libellé, date ou justificatif modifié"), ...errors },
});
const reverseRoute = createRoute({
  method: "post",
  path: "/treasury/transactions/{transactionId}/reverse",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: TxParams },
  responses: { 201: json(TransactionDto, "Écriture d'annulation"), ...errors },
});
const budgetRoute = createRoute({
  method: "put",
  path: "/events/{eventId}/budget",
  tags: ["treasury"],
  middleware: [requirePermission("budget:manage")] as const,
  request: { params: z.object({ eventId: z.uuid() }), ...body(SetEventBudgetInput) },
  responses: { 200: json(SetEventBudgetInput, "Budget enregistré"), ...errors },
});

export function createTreasuryRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(summaryRoute, async (c) => c.json(await getSummary(authedCtx(c.get("ctx"))), 200))
    .openapi(listRoute, async (c) =>
      c.json(await listTransactions(authedCtx(c.get("ctx")), c.req.valid("query").eventId), 200),
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
