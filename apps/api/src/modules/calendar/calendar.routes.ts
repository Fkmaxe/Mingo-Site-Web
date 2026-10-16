import { CalendarFeedDto, CalendarItemDto, CalendarQuery } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse, jsonResponse } from "../../core/http";
import { getCalendar, getFeed, renderFeed, renewFeed, revokeFeed } from "./calendar.service";

const errors = {
  400: errorResponse("Données invalides"),
  401: errorResponse("Pas de session"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
};

// Members only: checked in the service.
const calendarRoute = createRoute({
  method: "get",
  path: "/me/calendar",
  tags: ["calendar"],
  middleware: [requireAuth] as const,
  request: { query: CalendarQuery },
  responses: { 200: jsonResponse(z.array(CalendarItemDto), "Mon calendrier"), ...errors },
});
const feedRoute = createRoute({
  method: "get",
  path: "/me/calendar/feed",
  tags: ["calendar"],
  middleware: [requireAuth] as const,
  responses: { 200: jsonResponse(CalendarFeedDto, "Mon lien d'abonnement"), ...errors },
});
const renewRoute = createRoute({
  method: "post",
  path: "/me/calendar/feed",
  tags: ["calendar"],
  middleware: [requireAuth] as const,
  responses: { 200: jsonResponse(CalendarFeedDto, "Nouveau lien d'abonnement"), ...errors },
});
const revokeRoute = createRoute({
  method: "delete",
  path: "/me/calendar/feed",
  tags: ["calendar"],
  middleware: [requireAuth] as const,
  responses: { 200: jsonResponse(CalendarFeedDto, "Lien supprimé"), ...errors },
});
// No session: calendar apps fetch it with the secret token only.
const icsRoute = createRoute({
  method: "get",
  path: "/calendar/feeds/{token}",
  tags: ["calendar"],
  request: { params: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }) },
  responses: {
    200: { content: { "text/calendar": { schema: z.string() } }, description: "Flux iCal" },
    ...errors,
  },
});

export function createCalendarRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(calendarRoute, async (c) =>
      c.json(await getCalendar(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(feedRoute, async (c) => c.json(await getFeed(authedCtx(c.get("ctx"))), 200))
    .openapi(renewRoute, async (c) => c.json(await renewFeed(authedCtx(c.get("ctx"))), 200))
    .openapi(revokeRoute, async (c) => c.json(await revokeFeed(authedCtx(c.get("ctx"))), 200))
    .openapi(icsRoute, async (c) => {
      const body = await renderFeed(c.get("ctx"), c.req.valid("param").token);
      return c.body(body, 200, {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="bde-mingo.ics"',
        // Private to the token, always fresh.
        "cache-control": "private, no-cache",
      });
    });
}
