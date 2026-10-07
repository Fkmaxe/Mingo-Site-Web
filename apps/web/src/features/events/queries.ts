import "server-only";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Event, Pole } from "./types";

type ListParams = {
  scope?: "upcoming" | "past";
  manageable?: boolean;
  cursor?: string | undefined;
  limit?: number;
};

export async function listEvents(params: ListParams = {}) {
  const { data, response } = await (await api()).GET("/v1/events", {
    params: {
      query: {
        scope: params.scope ?? "upcoming",
        manageable: params.manageable ? "true" : "false",
        limit: params.limit ?? 20,
        ...(params.cursor ? { cursor: params.cursor } : {}),
      },
    },
  });
  if (!data) throw new Error(`GET /v1/events a échoué (${response.status})`);
  return data;
}

/** Event by slug or id, or the not-found page. */
export async function getEventOr404(ref: string): Promise<Event> {
  const { data, response } = await (await api()).GET("/v1/events/{eventRef}", {
    params: { path: { eventRef: ref } },
  });
  if (response.status === 404 || !data) notFound();
  return data;
}

export async function listPoles(): Promise<Pole[]> {
  const { data, error } = await (await api()).GET("/v1/poles");
  if (error || !data) throw new Error("GET /v1/poles a échoué");
  return data;
}
