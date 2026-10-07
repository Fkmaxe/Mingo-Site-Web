import "server-only";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Partner, PublicPartner } from "./types";

export async function listPublicPartners(): Promise<PublicPartner[]> {
  const { data, response } = await (await api()).GET("/v1/partners/public");
  if (!data) throw new Error(`GET /v1/partners/public a échoué (${response.status})`);
  return data;
}

export async function listPartners(): Promise<Partner[]> {
  const { data, response } = await (await api()).GET("/v1/partners");
  if (!data) throw new Error(`GET /v1/partners a échoué (${response.status})`);
  return data;
}

export async function getPartnerOr404(partnerId: string): Promise<Partner> {
  const { data } = await (await api()).GET("/v1/partners/{partnerId}", {
    params: { path: { partnerId } },
  });
  if (!data) notFound();
  return data;
}
