import { api } from "@/lib/api";
import { relayFile } from "@/lib/relay-file";

/** Task files, through the web (session cookie forwarded). */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { data, response } = await (await api()).GET("/v1/tasks/files/{name}", {
    params: { path: { name } },
    parseAs: "arrayBuffer",
  });
  return relayFile(data, response);
}
