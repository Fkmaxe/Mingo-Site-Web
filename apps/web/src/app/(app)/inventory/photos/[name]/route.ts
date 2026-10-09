import { api } from "@/lib/api";

/** Inventory photos, through the web: the browser never calls the API (session cookie forwarded). */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { data, response } = await (await api()).GET("/v1/inventory/photos/{name}", {
    params: { path: { name } },
    parseAs: "arrayBuffer",
  });
  if (!data) return new Response(null, { status: response.status === 403 ? 403 : 404 });
  return new Response(data, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
