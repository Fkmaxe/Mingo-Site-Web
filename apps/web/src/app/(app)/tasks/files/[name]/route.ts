import { api } from "@/lib/api";

/** Task files, through the web: the browser never calls the API (session cookie forwarded). */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { data, response } = await (await api()).GET("/v1/tasks/files/{name}", {
    params: { path: { name } },
    parseAs: "arrayBuffer",
  });
  if (!data) return new Response(null, { status: response.status === 403 ? 403 : 404 });
  return new Response(data, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      // Photos and PDF are shown in the page; other files are downloaded under their name.
      "content-disposition": response.headers.get("content-disposition") ?? "attachment",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
