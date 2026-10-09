import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./api-schema";
import { env } from "./server-env";

/** Path of the page shown while no school year is open (fresh install, between two years). */
export const NO_SCHOOL_YEAR_PATH = "/no-school-year";

/**
 * Pages need a current school year (roles, grades, points, treasury…). When the API says there
 * is none, a read goes to the page that explains it instead of failing with an error page.
 */
export const noSchoolYear: Middleware = {
  async onResponse({ request, response }) {
    if (request.method !== "GET" || response.status !== 422) return undefined;
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    const code =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object"
        ? (body.error as { code?: unknown }).code
        : undefined;
    if (code === "NO_CURRENT_SCHOOL_YEAR") redirect(NO_SCHOOL_YEAR_PATH);
    return undefined;
  },
};

/**
 * Typed API client for server components and server actions. The only way to call the API.
 * Forwards the session cookie of the current request.
 */
export async function api() {
  const cookie = (await cookies()).toString();
  const client = createClient<paths>({
    baseUrl: env.API_URL,
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  client.use(noSchoolYear);
  return client;
}
