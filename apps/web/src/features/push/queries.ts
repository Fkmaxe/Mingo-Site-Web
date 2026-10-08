import "server-only";
import { api } from "@/lib/api";

export async function getPushSetup() {
  const client = await api();
  const [config, status] = await Promise.all([
    client.GET("/v1/push/config"),
    client.GET("/v1/me/push"),
  ]);
  return {
    publicKey: config.data?.publicKey ?? null,
    devices: status.data?.devices ?? 0,
    newEvents: status.data?.newEvents ?? true,
  };
}
