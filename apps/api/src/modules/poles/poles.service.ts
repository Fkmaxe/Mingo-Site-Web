import type { PoleDto } from "@bde/shared";
import type { Ctx } from "../../core/context";
import { AppError } from "../../core/errors";
import { findAllPoles, findPoleById } from "./poles.repo";

export function listPoles(ctx: Pick<Ctx, "db">): Promise<PoleDto[]> {
  return findAllPoles(ctx.db);
}

export async function getPole(ctx: Pick<Ctx, "db">, poleId: string): Promise<PoleDto> {
  const found = await findPoleById(ctx.db, poleId);
  if (!found) throw new AppError("NOT_FOUND", 404, "Ce pôle n'existe pas.");
  return found;
}
