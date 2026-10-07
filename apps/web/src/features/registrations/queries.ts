import "server-only";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Registrant, Ticket } from "./types";

export async function listMyTickets(scope: "upcoming" | "past"): Promise<Ticket[]> {
  const { data, response } = await (await api()).GET("/v1/me/tickets", {
    params: { query: { scope } },
  });
  if (!data) throw new Error(`GET /v1/me/tickets a échoué (${response.status})`);
  return data;
}

export async function getTicketOr404(registrationId: string): Promise<Ticket> {
  const { data } = await (await api()).GET("/v1/tickets/{registrationId}", {
    params: { path: { registrationId } },
  });
  if (!data) notFound();
  return data;
}

/** Every registrant of an event (pages of 100). */
export async function listAllRegistrants(eventId: string): Promise<Registrant[]> {
  const client = await api();
  const all: Registrant[] = [];
  let cursor: string | undefined;
  do {
    const { data, response } = await client.GET("/v1/events/{eventId}/registrations", {
      params: { path: { eventId }, query: { limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    if (!data) throw new Error(`GET registrations a échoué (${response.status})`);
    all.push(...data.items);
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return all;
}
