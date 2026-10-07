import "server-only";
import { cookies } from "next/headers";
import createClient from "openapi-fetch";
import type { paths } from "./api-schema";
import { env } from "./server-env";

/**
 * Typed API client for server components and server actions. The only way to call the API.
 * Forwards the session cookie of the current request.
 */
export async function api() {
  const cookie = (await cookies()).toString();
  return createClient<paths>({
    baseUrl: env.API_URL,
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
}
