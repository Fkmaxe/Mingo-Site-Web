import { formatAnswer, type OpenPointsStatus, type RegistrationStatus } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { parisDateTime } from "../../core/time";
import { toCsv } from "../../lib/csv/csv";
import { eventAttendances } from "../checkin";
import { findManageableEvent } from "../events";
import { yearLedger } from "../open-points";
import { allRegistrants } from "../registrations";
import { requireCurrentSchoolYear } from "../school-years";

export type CsvFile = { filename: string; content: string };

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  confirmed: "Inscrit",
  waitlisted: "Liste d'attente",
  cancelled: "Annulé",
};

const OPEN_POINTS_LABELS: Record<OpenPointsStatus, string> = {
  pending: "En attente",
  validated: "Validé",
  rejected: "Refusé",
  exported: "Transmis",
};

async function audited(ctx: AuthedCtx, action: string, file: CsvFile, entityId: string | null) {
  await writeAudit(ctx.db, {
    actorUserId: ctx.user.id,
    action,
    entity: "export",
    entityId,
    payload: { filename: file.filename },
  });
  return file;
}

/** Registrants of an event, with whether they came. */
export async function exportRegistrations(ctx: AuthedCtx, eventId: string): Promise<CsvFile> {
  const event = await findManageableEvent(ctx, eventId);
  const [registrants, attendances] = await Promise.all([
    allRegistrants(ctx, event.id),
    eventAttendances(ctx, event.id),
  ]);
  const entered = new Map(
    attendances.filter((a) => a.kind === "participant").map((a) => [a.user.id, a.checkedInAt]),
  );
  const fields = event.customFieldsSchema;
  const content = toCsv(
    ["Nom", "Email", "Promo", "Statut", "Inscrit le", "Entrée", ...fields.map((f) => f.label)],
    registrants.map((r) => {
      const at = entered.get(r.user.id);
      return [
        r.user.name,
        r.user.email,
        r.user.promo,
        REGISTRATION_LABELS[r.status],
        parisDateTime(r.createdAt),
        at ? parisDateTime(at) : "",
        ...fields.map((f) => formatAnswer(r.answers[f.key])),
      ];
    }),
  );
  return audited(
    ctx,
    "export.registrations",
    { filename: `inscrits-${event.slug}.csv`, content },
    event.id,
  );
}

export async function exportAttendance(ctx: AuthedCtx, eventId: string): Promise<CsvFile> {
  const event = await findManageableEvent(ctx, eventId);
  const attendances = await eventAttendances(ctx, event.id);
  const content = toCsv(
    ["Nom", "Email", "Promo", "Type", "Entrée"],
    attendances.map((a) => [
      a.user.name,
      a.user.email,
      a.user.promo,
      a.kind === "participant" ? "Participant" : a.kind === "staff" ? "Staff" : "Réunion",
      parisDateTime(a.checkedInAt),
    ]),
  );
  return audited(
    ctx,
    "export.attendance",
    { filename: `presences-${event.slug}.csv`, content },
    event.id,
  );
}

/**
 * Open points of the current school year. `detail`: one line per movement.
 * `summary`: validated (and already transmitted) total per student, the figure the school needs.
 */
export async function exportOpenPoints(
  ctx: AuthedCtx,
  view: "detail" | "summary",
): Promise<CsvFile> {
  const year = await requireCurrentSchoolYear(ctx);
  const rows = await yearLedger(ctx, year.id);
  let content: string;
  if (view === "detail") {
    content = toCsv(
      ["Nom", "Email", "Promo", "Points", "Motif", "Événement", "Statut", "Date"],
      rows.map((r) => [
        r.user.name,
        r.user.email,
        r.user.promo,
        r.delta,
        r.reason,
        r.eventTitle,
        OPEN_POINTS_LABELS[r.status],
        parisDateTime(r.createdAt),
      ]),
    );
  } else {
    const totals = new Map<string, { user: (typeof rows)[number]["user"]; total: number }>();
    for (const r of rows) {
      if (r.status !== "validated" && r.status !== "exported") continue;
      const entry = totals.get(r.user.id) ?? { user: r.user, total: 0 };
      entry.total += r.delta;
      totals.set(r.user.id, entry);
    }
    content = toCsv(
      ["Nom", "Email", "Promo", "Points validés"],
      [...totals.values()].map((t) => [t.user.name, t.user.email, t.user.promo, t.total]),
    );
  }
  return audited(
    ctx,
    "export.open_points",
    {
      filename: `points-open-${year.label}-${view === "detail" ? "detail" : "total"}.csv`,
      content,
    },
    null,
  );
}
