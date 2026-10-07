import { authHeaders } from "./auth";
import { createTestApp } from "./env";

/** Sends a request to a fresh test app, signed in as `userId` (or anonymously). */
export async function call(
  method: string,
  path: string,
  userId: string | null = null,
  body?: unknown,
): Promise<Response> {
  const headers = userId ? await authHeaders(userId) : new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  return createTestApp().request(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
