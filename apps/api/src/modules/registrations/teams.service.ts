import type { CreateTeamInput, JoinTeamInput, TeamDto } from "@bde/shared";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransactionWithEffects } from "../../core/tx";
import type { DbOrTx } from "../../db/client";
import { type EventRow, findManageableEvent, findVisibleEvent } from "../events";
import { findRegistration, lockEventRegistrations } from "./registrations.repo";
import { enrol, parseAnswers } from "./registrations.service";
import { isTeamEvent, newJoinCode, teamIsComplete, teamIsFull } from "./rules";
import {
  findTeam,
  findTeamByCode,
  findTeamMembers,
  findTeamsOfEvent,
  insertTeam,
  joinCodeExists,
  teamNameExists,
} from "./teams.repo";

type TeamRow = NonNullable<Awaited<ReturnType<typeof findTeam>>>;
type TeamEvent = EventRow & { teamMinSize: number; teamMaxSize: number };

async function toTeamDtos(db: DbOrTx, teams: TeamRow[], minSize: number): Promise<TeamDto[]> {
  const members = await findTeamMembers(
    db,
    teams.map((t) => t.id),
  );
  return teams.map((t) => {
    const own = members
      .filter((m) => m.teamId === t.id)
      .map((m) => ({
        userId: m.userId,
        name: m.name,
        promo: m.promo,
        status: m.status === "waitlisted" ? ("waitlisted" as const) : ("confirmed" as const),
      }));
    return {
      id: t.id,
      name: t.name,
      joinCode: t.joinCode,
      captainId: t.captainUserId,
      members: own,
      complete: teamIsComplete(own.filter((m) => m.status === "confirmed").length, minSize),
    };
  });
}

async function toTeamDto(db: DbOrTx, team: TeamRow, minSize: number): Promise<TeamDto> {
  const [dto] = await toTeamDtos(db, [team], minSize);
  if (!dto) throw teamNotFound();
  return dto;
}

const teamNotFound = () => new AppError("NOT_FOUND", 404, "Cette équipe n'existe pas.");

async function findTeamEvent(ctx: AuthedCtx, eventId: string): Promise<TeamEvent> {
  const event = await findVisibleEvent(ctx, eventId);
  if (!isTeamEvent(event)) {
    throw new AppError("NOT_TEAM_EVENT", 409, "Cet événement ne se joue pas en équipe.");
  }
  return event;
}

async function uniqueJoinCode(db: DbOrTx): Promise<string> {
  for (;;) {
    const code = newJoinCode();
    if (!(await joinCodeExists(db, code))) return code;
  }
}

/** Creates a team with the current user as captain and registers them in it. */
export async function createTeam(
  ctx: AuthedCtx,
  eventId: string,
  input: CreateTeamInput,
  now: Date = new Date(),
): Promise<TeamDto> {
  const event = await findTeamEvent(ctx, eventId);
  const answers = parseAnswers(event, input.answers ?? {});
  const teamId = await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await lockEventRegistrations(tx, event.id);
    if (await teamNameExists(tx, event.id, input.name)) {
      throw new AppError("TEAM_NAME_TAKEN", 409, "Une équipe porte déjà ce nom.");
    }
    const id = await insertTeam(tx, {
      eventId: event.id,
      name: input.name,
      joinCode: await uniqueJoinCode(tx),
      captainUserId: ctx.user.id,
    });
    await enrol(tx, defer, ctx, event, { answers, teamId: id }, now);
    return id;
  });
  return getTeam(ctx.db, teamId, event.teamMinSize);
}

/** Registers the current user in the team of this event whose code they were given. */
export async function joinTeam(
  ctx: AuthedCtx,
  eventId: string,
  input: JoinTeamInput,
  now: Date = new Date(),
): Promise<TeamDto> {
  const event = await findTeamEvent(ctx, eventId);
  const answers = parseAnswers(event, input.answers ?? {});
  const teamId = await inTransactionWithEffects(ctx.db, async (tx, defer) => {
    await lockEventRegistrations(tx, event.id);
    const team = await findTeamByCode(tx, event.id, input.code);
    if (!team) {
      throw new AppError("NOT_FOUND", 404, "Aucune équipe avec ce code pour cet événement.");
    }
    const members = await findTeamMembers(tx, [team.id]);
    if (
      !members.some((m) => m.userId === ctx.user.id) &&
      teamIsFull(members.length, event.teamMaxSize)
    ) {
      throw new AppError(
        "TEAM_FULL",
        409,
        `Cette équipe est complète (${event.teamMaxSize} personnes maximum).`,
      );
    }
    await enrol(tx, defer, ctx, event, { answers, teamId: team.id }, now);
    return team.id;
  });
  return getTeam(ctx.db, teamId, event.teamMinSize);
}

async function getTeam(db: DbOrTx, teamId: string, minSize: number): Promise<TeamDto> {
  const team = await findTeam(db, teamId);
  if (!team) throw teamNotFound();
  return toTeamDto(db, team, minSize);
}

/** The current user's team for this event (404 when they are not in one). */
export async function getMyTeam(ctx: AuthedCtx, eventId: string): Promise<TeamDto> {
  const event = await findTeamEvent(ctx, eventId);
  const mine = await findRegistration(ctx.db, event.id, ctx.user.id);
  if (!mine?.teamId || mine.status === "cancelled") {
    throw new AppError("NOT_FOUND", 404, "Tu n'es dans aucune équipe pour cet événement.");
  }
  return getTeam(ctx.db, mine.teamId, event.teamMinSize);
}

/** Every team of the event, for its organisers. */
export async function listTeams(ctx: AuthedCtx, eventId: string): Promise<TeamDto[]> {
  const event = await findManageableEvent(ctx, eventId);
  if (!isTeamEvent(event)) return [];
  return toTeamDtos(ctx.db, await findTeamsOfEvent(ctx.db, event.id), event.teamMinSize);
}
