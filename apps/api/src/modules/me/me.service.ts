import type { MeDto } from "@bde/shared";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { findCurrentMemberships, findUserById } from "./me.repo";

export async function getMe(ctx: AuthedCtx): Promise<MeDto> {
  const [user, memberships] = await Promise.all([
    findUserById(ctx.db, ctx.user.id),
    findCurrentMemberships(ctx.db, ctx.user.id),
  ]);
  if (!user) throw new AppError("UNAUTHENTICATED", 401, "Ton compte n'existe plus.");
  return {
    ...user,
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      boardPosition: m.boardPosition,
      pole:
        m.poleId && m.poleSlug && m.poleName
          ? { id: m.poleId, slug: m.poleSlug, name: m.poleName }
          : null,
    })),
  };
}
