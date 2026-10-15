import { api } from "@/lib/api";

/**
 * iCal feed of a member, read by calendar apps (no session: the token in the name is the only
 * credential). Relayed by the web like every API call.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const token = /^([A-Za-z0-9_-]{43})\.ics$/.exec((await params).file)?.[1];
  if (!token) return new Response(null, { status: 404 });
  const { data } = await (await api()).GET("/v1/calendar/feeds/{token}", {
    params: { path: { token } },
    parseAs: "text",
  });
  if (data === undefined) return new Response(null, { status: 404 });
  return new Response(data, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="bde-mingo.ics"',
      "cache-control": "private, no-cache",
      "x-robots-tag": "noindex",
    },
  });
}
