import "server-only";
import { api } from "@/lib/api";
import type { Transaction, TreasurySummary } from "./types";

export async function getSummary(): Promise<TreasurySummary> {
  const { data, response } = await (await api()).GET("/v1/treasury/summary");
  if (!data) throw new Error(`GET /v1/treasury/summary a échoué (${response.status})`);
  return data;
}

export async function listTransactions(): Promise<Transaction[]> {
  const { data, response } = await (await api()).GET("/v1/treasury/transactions", {
    params: { query: {} },
  });
  if (!data) throw new Error(`GET /v1/treasury/transactions a échoué (${response.status})`);
  return data;
}
