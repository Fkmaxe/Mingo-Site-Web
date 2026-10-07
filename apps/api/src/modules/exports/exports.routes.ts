import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { type AppEnv, authedCtx } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  type CsvFile,
  exportAttendance,
  exportOpenPoints,
  exportRegistrations,
} from "./exports.service";

const csvResponse = (description: string) => ({
  content: { "text/csv": { schema: z.string() } },
  description,
});

function sendCsv(c: Context<AppEnv>, file: CsvFile) {
  return c.body(file.content, 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${file.filename}"`,
    "cache-control": "no-store",
  });
}

const EventIdParams = z.object({ eventId: z.uuid() });

const eventExportRoute = (kind: "registrations" | "attendance", description: string) =>
  createRoute({
    method: "get",
    path: `/events/{eventId}/exports/${kind}.csv`,
    tags: ["exports"],
    middleware: [requirePermission("exports:run")] as const,
    request: { params: EventIdParams },
    responses: {
      200: csvResponse(description),
      403: errorResponse("Réservé au bureau"),
      404: errorResponse("Événement introuvable"),
    },
  });

const openPointsRoute = createRoute({
  method: "get",
  path: "/exports/open-points.csv",
  tags: ["exports"],
  middleware: [requirePermission("exports:run")] as const,
  request: { query: z.object({ view: z.enum(["detail", "summary"]).default("summary") }) },
  responses: {
    200: csvResponse("Points open de l'année en cours"),
    403: errorResponse("Réservé au bureau"),
    422: errorResponse("Aucune année scolaire en cours"),
  },
});

export function createExportsRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(eventExportRoute("registrations", "Inscrits (avec l'heure d'entrée)"), async (c) =>
      sendCsv(c, await exportRegistrations(authedCtx(c.get("ctx")), c.req.valid("param").eventId)),
    )
    .openapi(eventExportRoute("attendance", "Présences"), async (c) =>
      sendCsv(c, await exportAttendance(authedCtx(c.get("ctx")), c.req.valid("param").eventId)),
    )
    .openapi(openPointsRoute, async (c) =>
      sendCsv(c, await exportOpenPoints(authedCtx(c.get("ctx")), c.req.valid("query").view)),
    );
}
