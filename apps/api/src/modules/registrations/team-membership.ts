import type { DbOrTx } from "../../db/client";
import { nextCaptain } from "./rules";
import { deleteTeam, findTeam, findTeamMembers, setTeamCaptain } from "./teams.repo";

/**
 * After `userId` left the team (registration cancelled): an empty team is deleted, which frees
 * its name; a team that lost its captain gets the earliest remaining member as captain.
 */
export async function afterTeamLeft(tx: DbOrTx, teamId: string, userId: string): Promise<void> {
  const team = await findTeam(tx, teamId);
  if (!team) return;
  const captain = nextCaptain(await findTeamMembers(tx, [teamId]));
  if (captain === null) await deleteTeam(tx, teamId);
  else if (team.captainUserId === userId) await setTeamCaptain(tx, teamId, captain);
}
