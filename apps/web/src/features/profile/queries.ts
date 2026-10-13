import "server-only";
import { api } from "@/lib/api";

export async function listClasses() {
  const { data, response } = await (await api()).GET("/v1/classes");
  if (!data) throw new Error(`GET /v1/classes a échoué (${response.status})`);
  return data;
}
