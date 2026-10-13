import type { MemberDirectoryEntryDto } from "@bde/shared";
import type { Ctx } from "../../core/context";
import { avatarPath } from "../me";
import { findDirectory } from "./members.repo";

export async function listDirectory(ctx: Pick<Ctx, "db">): Promise<MemberDirectoryEntryDto[]> {
  return (await findDirectory(ctx.db)).map((row) => ({
    membershipId: row.membershipId,
    role: row.role,
    boardPosition: row.boardPosition,
    pole: row.poleId && row.poleName ? { id: row.poleId, name: row.poleName } : null,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      promo: row.user.promo,
      avatarUrl: row.user.image ? avatarPath(row.user.image) : null,
    },
  }));
}
