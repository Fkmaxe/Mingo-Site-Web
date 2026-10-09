import { composeName, type MeDto, type UpdateProfileInput } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { findCurrentMemberships, findUserById, updateUserNames } from "./me.repo";

const accountGone = () => new AppError("UNAUTHENTICATED", 401, "Ton compte n'existe plus.");

export async function getMe(ctx: AuthedCtx): Promise<MeDto> {
  const [user, memberships] = await Promise.all([
    findUserById(ctx.db, ctx.user.id),
    findCurrentMemberships(ctx.db, ctx.user.id),
  ]);
  if (!user) throw accountGone();
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
    roles: ctx.roles,
    permissions: [...ctx.permissions].sort(),
  };
}

/** Changes the user's own first and last name; `name` follows ("First Last"). */
export async function updateProfile(ctx: AuthedCtx, input: UpdateProfileInput): Promise<MeDto> {
  await inTransaction(ctx.db, async (tx) => {
    const before = await findUserById(tx, ctx.user.id);
    if (!before) throw accountGone();
    const after = {
      firstName: input.firstName,
      lastName: input.lastName,
      name: composeName(input.firstName, input.lastName),
    };
    if (before.firstName === after.firstName && before.lastName === after.lastName) return;
    await updateUserNames(tx, ctx.user.id, after);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "user.profile_updated",
      entity: "user",
      entityId: ctx.user.id,
      payload: {
        before: { firstName: before.firstName, lastName: before.lastName },
        after: { firstName: after.firstName, lastName: after.lastName },
      },
    });
  });
  return getMe(ctx);
}
