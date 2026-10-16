import { api } from "@/lib/api";
import { relayFile } from "@/lib/relay-file";

/** Payment receipts, through the web (session cookie forwarded): shown in the entry's page. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { data, response } = await (await api()).GET("/v1/treasury/attachments/{name}", {
    params: { path: { name } },
    parseAs: "arrayBuffer",
  });
  return relayFile(data, response);
}
