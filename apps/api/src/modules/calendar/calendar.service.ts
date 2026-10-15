import { randomBytes } from "node:crypto";
import type { CalendarFeedDto, CalendarItemDto, CalendarQuery } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx, Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { loadAuthorization } from "../../core/permissions";
import { parisDate } from "../../core/time";
import { inTransaction } from "../../core/tx";
import { buildIcs, type IcsEvent } from "../../lib/ics";
import { listEventsBetween } from "../events";
import { listMeetingsBetween } from "../meetings";
import { listMyDueTasks } from "../tasks";
import {
  deleteFeed,
  findFeedOfUser,
  findFeedOwner,
  markFeedFetched,
  upsertFeed,
} from "./calendar.repo";

const DAY_MS = 24 * 3600 * 1000;
/** Meetings have a start only: shown as one hour. */
const MEETING_MS = 3600 * 1000;
/** The subscription feed covers two months back and a year ahead. */
const FEED_PAST_DAYS = 60;
const FEED_FUTURE_DAYS = 365;

const MEETING_LABELS = {
  general: "Réunion générale",
  board: "Réunion du bureau",
  leads: "Réunion bureau + responsables",
} as const;

const TASK_BOARDS = { personal: "Perso", board: "Bureau" } as const;

/**
 * Everything of the member between two Paris days (inclusive): every event they can see, the
 * meetings they are expected at, and their open tasks with a deadline.
 */
async function itemsBetween(ctx: AuthedCtx, fromDay: string, toDay: string) {
  // UTC bounds a day wider than the Paris days; items are then kept by their Paris day.
  const from = new Date(Date.parse(`${fromDay}T00:00:00Z`) - DAY_MS);
  const to = new Date(Date.parse(`${toDay}T00:00:00Z`) + 2 * DAY_MS);
  const [events, meetings, tasks] = await Promise.all([
    listEventsBetween(ctx, from, to),
    listMeetingsBetween(ctx, from, to),
    listMyDueTasks(ctx, fromDay, toDay),
  ]);
  const items: CalendarItemDto[] = [
    ...events
      .filter((e) => parisDate(e.startsAt) <= toDay && parisDate(e.endsAt) >= fromDay)
      .map((e) => ({
        id: `event-${e.id}`,
        kind: "event" as const,
        title: e.title,
        day: parisDate(e.startsAt),
        allDay: false,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        location: e.location,
        label: `Pôle ${e.pole.name}`,
        cancelled: e.status === "cancelled",
        path: `/events/${e.slug}`,
      })),
    ...meetings
      .filter((m) => {
        const day = parisDate(m.meeting.startsAt);
        return day >= fromDay && day <= toDay;
      })
      .map(({ meeting, pole }) => ({
        id: `meeting-${meeting.id}`,
        kind: "meeting" as const,
        title: meeting.title,
        day: parisDate(meeting.startsAt),
        allDay: false,
        startsAt: meeting.startsAt.toISOString(),
        endsAt: new Date(meeting.startsAt.getTime() + MEETING_MS).toISOString(),
        location: meeting.location,
        label:
          meeting.kind === "pole"
            ? `Réunion · Pôle ${pole?.name ?? ""}`
            : MEETING_LABELS[meeting.kind],
        cancelled: false,
        path: `/meetings/${meeting.id}`,
      })),
    ...tasks.flatMap((t) =>
      t.dueOn
        ? [
            {
              id: `task-${t.id}`,
              kind: "task" as const,
              title: t.title,
              day: t.dueOn,
              allDay: true,
              startsAt: null,
              endsAt: null,
              location: "",
              label: `Tâche · ${t.scope === "pole" ? `Pôle ${t.pole?.name ?? ""}` : TASK_BOARDS[t.scope]}`,
              cancelled: false,
              path: `/tasks/${t.id}`,
            },
          ]
        : [],
    ),
  ];
  // By day, whole-day items first, then by time.
  return items.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.startsAt ?? "").localeCompare(b.startsAt ?? ""),
  );
}

const membersOnly = () =>
  new AppError("FORBIDDEN", 403, "Le calendrier est réservé aux membres du BDE.");

export async function getCalendar(ctx: AuthedCtx, query: CalendarQuery) {
  if (!ctx.roles.includes("member")) throw membersOnly();
  return itemsBetween(ctx, query.from, query.to);
}

// --- Subscription link ---

const feedUrl = (ctx: Pick<Ctx, "services">, token: string) =>
  `${ctx.services.webOrigin}/calendar/feed/${token}.ics`;

export async function getFeed(ctx: AuthedCtx): Promise<CalendarFeedDto> {
  const feed = await findFeedOfUser(ctx.db, ctx.user.id);
  return { url: feed ? feedUrl(ctx, feed.token) : null };
}

/** Creates the member's private link, or a new one that replaces it. */
export async function renewFeed(ctx: AuthedCtx, now: Date = new Date()): Promise<CalendarFeedDto> {
  if (!ctx.roles.includes("member")) throw membersOnly();
  const token = randomBytes(32).toString("base64url");
  const existed = (await findFeedOfUser(ctx.db, ctx.user.id)) !== undefined;
  await inTransaction(ctx.db, async (tx) => {
    await upsertFeed(tx, ctx.user.id, token, now);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: existed ? "calendar_feed.renewed" : "calendar_feed.created",
      entity: "calendar_feed",
      entityId: ctx.user.id,
    });
  });
  return { url: feedUrl(ctx, token) };
}

export async function revokeFeed(ctx: AuthedCtx): Promise<CalendarFeedDto> {
  await inTransaction(ctx.db, async (tx) => {
    await deleteFeed(tx, ctx.user.id);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "calendar_feed.revoked",
      entity: "calendar_feed",
      entityId: ctx.user.id,
    });
  });
  return { url: null };
}

function toIcsEvent(ctx: Pick<Ctx, "services">, item: CalendarItemDto): IcsEvent {
  const url = `${ctx.services.webOrigin}${item.path}`;
  const base = {
    uid: `${item.id}@bde-mingo`,
    summary: `${item.cancelled ? "Annulé : " : ""}${item.kind === "task" ? "Tâche : " : ""}${item.title}`,
    description: `${item.label}\n${url}`,
    location: item.location,
    url,
    cancelled: item.cancelled,
  };
  return item.allDay || !item.startsAt || !item.endsAt
    ? { ...base, day: item.day }
    : { ...base, start: new Date(item.startsAt), end: new Date(item.endsAt) };
}

/**
 * The iCal feed of a link, read by Apple Calendar or Google Agenda without a session: the token
 * stands for the member. Someone who left the BDE gets an empty calendar.
 */
export async function renderFeed(
  deps: Pick<Ctx, "db" | "services">,
  token: string,
  now: Date = new Date(),
): Promise<string> {
  const owner = await findFeedOwner(deps.db, token);
  if (!owner) throw new AppError("NOT_FOUND", 404, "Ce lien de calendrier n'existe plus.");
  const ctx: AuthedCtx = {
    ...deps,
    user: owner,
    ...(await loadAuthorization(deps.db, owner.id)),
  };
  const items = ctx.roles.includes("member")
    ? await itemsBetween(
        ctx,
        parisDate(new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS)),
        parisDate(new Date(now.getTime() + FEED_FUTURE_DAYS * DAY_MS)),
      )
    : [];
  await markFeedFetched(deps.db, token, now);
  return buildIcs(
    {
      name: "BDE Mingo",
      description: `Événements, réunions et tâches de ${owner.name}`,
      events: items.map((item) => toIcsEvent(ctx, item)),
    },
    now,
  );
}
