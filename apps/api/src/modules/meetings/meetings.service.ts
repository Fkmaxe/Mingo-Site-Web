import type { CreateMeetingData, MeetingDto, MeetingKind, UpdateMeetingData } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { getPole } from "../poles";
import {
  findExpectedMembers,
  findMeeting,
  findMeetings,
  findPresentUserIds,
  insertMeeting,
  type MeetingRow,
  markAbsent,
  markPresent,
  updateMeeting as updateMeetingRow,
} from "./meetings.repo";

type AuthzCtx = Pick<AuthedCtx, "user" | "roles" | "permissions" | "memberships">;
type Target = { kind: MeetingKind; poleId: string | null };

/** Meetings without a pole: the board. Pole meetings: the pole's lead or the board. */
function canManage(ctx: AuthzCtx, t: Target): boolean {
  if (!ctx.permissions.has("meetings:manage")) return false;
  if (ctx.permissions.has("poles:all")) return true;
  return (
    t.kind === "pole" &&
    ctx.memberships.some((m) => m.role === "pole_lead" && m.poleId === t.poleId)
  );
}

/** Kinds of meetings without a pole the user sees (the board sees them all). */
function visibleKinds(ctx: AuthzCtx): Exclude<MeetingKind, "pole">[] {
  return ctx.roles.includes("pole_lead") ? ["general", "leads"] : ["general"];
}

/** What `findMeetings` may return: everything for the board, else kinds and poles. */
function visibleTo(ctx: AuthzCtx) {
  return ctx.permissions.has("poles:all")
    ? ("all" as const)
    : {
        kinds: visibleKinds(ctx),
        poleIds: ctx.memberships.flatMap((m) => (m.poleId ? [m.poleId] : [])),
      };
}

function canView(ctx: AuthzCtx, t: Target): boolean {
  if (!ctx.roles.includes("member")) return false;
  if (ctx.permissions.has("poles:all")) return true;
  if (t.kind === "pole") return ctx.memberships.some((m) => m.poleId === t.poleId);
  return visibleKinds(ctx).includes(t.kind);
}

const notFound = () => new AppError("NOT_FOUND", 404, "Cette réunion n'existe pas.");
const forbidden = () => new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");

async function toDto(ctx: AuthedCtx, row: MeetingRow, withAttendees: boolean): Promise<MeetingDto> {
  const manager = canManage(ctx, row.meeting);
  const present = await findPresentUserIds(ctx.db, row.meeting.id);
  const attendees =
    manager && withAttendees
      ? (await findExpectedMembers(ctx.db, row.meeting)).map((u) => ({
          user: u,
          present: present.has(u.id),
        }))
      : [];
  return {
    id: row.meeting.id,
    title: row.meeting.title,
    startsAt: row.meeting.startsAt.toISOString(),
    location: row.meeting.location,
    agenda: row.meeting.agenda,
    minutes: row.meeting.minutes,
    kind: row.meeting.kind,
    pole: row.pole?.id && row.pole.name ? { id: row.pole.id, name: row.pole.name } : null,
    canManage: manager,
    present: present.has(ctx.user.id),
    attendees,
  };
}

async function visibleMeeting(ctx: AuthedCtx, meetingId: string) {
  const row = await findMeeting(ctx.db, meetingId);
  if (!row || !canView(ctx, row.meeting)) throw notFound();
  return row;
}

async function manageableMeeting(ctx: AuthedCtx, meetingId: string) {
  const row = await visibleMeeting(ctx, meetingId);
  if (!canManage(ctx, row.meeting)) throw forbidden();
  return row;
}

/** Meetings still "upcoming" until a few hours after they started. */
const UPCOMING_GRACE_MS = 6 * 3600 * 1000;

export async function listMeetings(
  ctx: AuthedCtx,
  scope: "upcoming" | "past",
  now: Date = new Date(),
): Promise<MeetingDto[]> {
  if (!ctx.roles.includes("member")) return [];
  const visible = visibleTo(ctx);
  const rows = await findMeetings(ctx.db, {
    visible,
    scope,
    since: new Date(now.getTime() - UPCOMING_GRACE_MS),
  });
  return Promise.all(rows.map((row) => toDto(ctx, row, false)));
}

export async function getMeeting(ctx: AuthedCtx, meetingId: string) {
  return toDto(ctx, await visibleMeeting(ctx, meetingId), true);
}

export async function createMeeting(ctx: AuthedCtx, input: CreateMeetingData) {
  if (input.poleId) await getPole(ctx, input.poleId);
  if (!canManage(ctx, input)) throw forbidden();
  const id = await insertMeeting(ctx.db, {
    ...input,
    startsAt: new Date(input.startsAt),
    createdBy: ctx.user.id,
  });
  return getMeeting(ctx, id);
}

export async function updateMeeting(ctx: AuthedCtx, meetingId: string, input: UpdateMeetingData) {
  const row = await manageableMeeting(ctx, meetingId);
  await updateMeetingRow(ctx.db, row.meeting.id, {
    ...input,
    startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
  });
  return getMeeting(ctx, row.meeting.id);
}

export async function deleteMeeting(ctx: AuthedCtx, meetingId: string, now: Date = new Date()) {
  const row = await manageableMeeting(ctx, meetingId);
  await inTransaction(ctx.db, async (tx) => {
    await updateMeetingRow(tx, row.meeting.id, { deletedAt: now });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "meeting.deleted",
      entity: "meeting",
      entityId: row.meeting.id,
      payload: { title: row.meeting.title },
    });
  });
}

/** Marks an expected member present or absent (presence counts in the grade). */
export async function setAttendance(
  ctx: AuthedCtx,
  meetingId: string,
  input: { userId: string; present: boolean },
) {
  const row = await manageableMeeting(ctx, meetingId);
  const expected = await findExpectedMembers(ctx.db, row.meeting);
  if (!expected.some((u) => u.id === input.userId)) {
    throw new AppError("NOT_A_MEMBER", 422, "Cette personne n'est pas attendue à cette réunion.");
  }
  if (input.present) await markPresent(ctx.db, row.meeting.id, input.userId, ctx.user.id);
  else await markAbsent(ctx.db, row.meeting.id, input.userId);
  return getMeeting(ctx, row.meeting.id);
}
