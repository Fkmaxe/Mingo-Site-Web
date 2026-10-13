import "server-only";
import type { TreasuryKind } from "@bde/shared";
import { notFound } from "next/navigation";
import { listEvents } from "@/features/events/queries";
import { listDirectory } from "@/features/members/queries";
import { api } from "@/lib/api";
import { BOARD_POSITION_LABELS } from "@/lib/labels";
import type {
  EventBudget,
  Initiator,
  Transaction,
  TransactionDetail,
  TreasurySummary,
} from "./types";

export async function getSummary(): Promise<TreasurySummary> {
  const { data, response } = await (await api()).GET("/v1/treasury/summary");
  if (!data) throw new Error(`GET /v1/treasury/summary a échoué (${response.status})`);
  return data;
}

export async function listTransactions(
  filter: { q?: string | undefined; kind?: TreasuryKind | undefined } = {},
): Promise<Transaction[]> {
  const { data, response } = await (await api()).GET("/v1/treasury/transactions", {
    params: {
      query: {
        ...(filter.q ? { q: filter.q } : {}),
        ...(filter.kind ? { kind: filter.kind } : {}),
      },
    },
  });
  if (!data) throw new Error(`GET /v1/treasury/transactions a échoué (${response.status})`);
  return data;
}

export async function getTransactionOr404(transactionId: string): Promise<TransactionDetail> {
  const { data, response } = await (await api()).GET("/v1/treasury/transactions/{transactionId}", {
    params: { path: { transactionId } },
  });
  if (response.status === 404 || response.status === 400) notFound();
  if (!data) throw new Error(`GET transaction a échoué (${response.status})`);
  return data;
}

export async function getEventBudget(eventId: string): Promise<EventBudget> {
  const { data, response } = await (await api()).GET("/v1/events/{eventId}/budget", {
    params: { path: { eventId } },
  });
  if (!data) throw new Error(`GET budget a échoué (${response.status})`);
  return data;
}

/** The BDE members of the year, once each, for the initiator search. */
export async function listInitiators(): Promise<Initiator[]> {
  const byUser = new Map<string, Initiator>();
  for (const entry of await listDirectory()) {
    const role = entry.pole
      ? `Pôle ${entry.pole.name}`
      : entry.boardPosition
        ? BOARD_POSITION_LABELS[entry.boardPosition]
        : "Bureau";
    const known = byUser.get(entry.user.id);
    byUser.set(entry.user.id, {
      id: entry.user.id,
      name: entry.user.name,
      avatarUrl: entry.user.avatarUrl,
      detail: known ? `${known.detail}, ${role}` : role,
    });
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Events an entry can be tied to: those of the user's poles, past and upcoming, by date. */
export async function listTreasuryEvents(): Promise<{ id: string; title: string }[]> {
  const [upcoming, past] = await Promise.all([
    listEvents({ scope: "upcoming", manageable: true, limit: 50 }),
    listEvents({ scope: "past", manageable: true, limit: 50 }),
  ]);
  return [...past.items, ...upcoming.items]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((e) => ({ id: e.id, title: e.title }));
}
