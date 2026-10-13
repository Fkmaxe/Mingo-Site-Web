import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { api } from "@/lib/api";
import { env } from "@/lib/server-env";

export async function listClasses() {
  const { data, response } = await (await api()).GET("/v1/classes");
  if (!data) throw new Error(`GET /v1/classes a échoué (${response.status})`);
  return data;
}

const Passkeys = z.array(
  z.object({
    id: z.string(),
    name: z.string().nullish(),
    deviceType: z.string().nullish(),
    createdAt: z.coerce.date(),
  }),
);
export type PasskeySummary = z.infer<typeof Passkeys>[number];

/** Passkeys of the signed-in user. A Better Auth endpoint (not in the OpenAPI), read server-side. */
export async function listPasskeys(): Promise<PasskeySummary[]> {
  const cookie = (await cookies()).toString();
  const response = await fetch(`${env.API_URL}/api/auth/passkey/list-user-passkeys`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Liste des passkeys : échec (${response.status})`);
  return Passkeys.parse(await response.json());
}
