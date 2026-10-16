/**
 * Relays a private file read from the API (task files, application documents) to the browser,
 * which never calls the API: same type and disposition (shown in the page, or downloaded under
 * its name), cached for good since names are random and never reused.
 */
export function relayFile(data: ArrayBuffer | undefined, response: Response): Response {
  if (!data) return new Response(null, { status: response.status === 403 ? 403 : 404 });
  return new Response(data, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": response.headers.get("content-disposition") ?? "attachment",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
