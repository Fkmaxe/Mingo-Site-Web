import { proxyDownload } from "@/lib/download";

export function GET() {
  return proxyDownload("/v1/exports/treasury.csv");
}
