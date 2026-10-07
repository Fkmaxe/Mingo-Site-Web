import { z } from "zod";
import { proxyDownload } from "@/lib/download";

const Params = z.object({ eventId: z.uuid(), kind: z.enum(["registrations", "attendance"]) });

export async function GET(_: Request, { params }: { params: Promise<unknown> }) {
  const parsed = Params.safeParse(await params);
  if (!parsed.success) return new Response("Export inconnu.", { status: 404 });
  const { eventId, kind } = parsed.data;
  return proxyDownload(`/v1/events/${eventId}/exports/${kind}.csv`);
}
