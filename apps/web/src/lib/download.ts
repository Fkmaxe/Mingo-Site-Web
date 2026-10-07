import "server-only";
import { cookies } from "next/headers";
import { env } from "./server-env";

/**
 * Streams a file produced by the API (CSV exports) to the browser, forwarding the session
 * cookie. The API checks permissions; errors come back as a short French message.
 */
export async function proxyDownload(apiPath: string): Promise<Response> {
  const cookie = (await cookies()).toString();
  const upstream = await fetch(`${env.API_URL}${apiPath}`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  if (!upstream.ok) {
    const body = (await upstream.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return new Response(body?.error?.message ?? "Export impossible.", {
      status: upstream.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
