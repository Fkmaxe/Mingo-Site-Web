import type { AppRole, BoardPosition, MembershipRole } from "@bde/shared";

export type ActiveMembership = {
  poleId: string | null;
  role: MembershipRole;
  boardPosition: BoardPosition | null;
};

/**
 * Effective roles from the user and their active memberships of the current school year.
 * Roles are cumulative: everyone is a student, pole leads and board members are also members.
 */
export function resolveRoles(
  user: { isAdmin: boolean },
  memberships: readonly ActiveMembership[],
): AppRole[] {
  const roles = new Set<AppRole>(["student"]);
  for (const m of memberships) {
    roles.add("member");
    if (m.role === "pole_lead") roles.add("pole_lead");
    if (m.role === "board") roles.add("board");
    if (m.boardPosition === "treasurer") roles.add("treasurer");
  }
  if (user.isAdmin) roles.add("admin");
  return [...roles];
}
