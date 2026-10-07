import { proxyDownload } from "@/lib/download";

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view") === "detail" ? "detail" : "summary";
  return proxyDownload(`/v1/exports/open-points.csv?view=${view}`);
}
