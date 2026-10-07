import type { CreatePartnerData, PartnerDto, UpdatePartnerData } from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import {
  findActivePartners,
  findPartner,
  findPartners,
  insertPartner,
  isCurrentMembership,
  type PartnerRow,
  updatePartner as updatePartnerRow,
} from "./partners.repo";

type AuthzCtx = Pick<AuthedCtx, "user" | "permissions">;

/** The board, or the member in charge of this partner. */
function canEdit(ctx: AuthzCtx, row: PartnerRow): boolean {
  return ctx.permissions.has("partners:manage") || row.owner?.userId === ctx.user.id;
}

function toDto(ctx: AuthzCtx, row: PartnerRow): PartnerDto {
  const p = row.partner;
  return {
    id: p.id,
    name: p.name,
    website: p.website,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    status: p.status,
    benefits: p.benefits,
    notes: p.notes,
    owner:
      row.owner?.membershipId && row.owner.name
        ? { membershipId: row.owner.membershipId, name: row.owner.name }
        : null,
    canEdit: canEdit(ctx, row),
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

const notFound = () => new AppError("NOT_FOUND", 404, "Ce partenaire n'existe pas.");

async function assertOwner(ctx: AuthedCtx, membershipId: string | null | undefined) {
  if (membershipId && !(await isCurrentMembership(ctx.db, membershipId))) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      "Ce référent n'est pas membre du BDE cette année.",
      {
        issues: [
          {
            path: ["ownerMembershipId"],
            message: "Ce référent n'est pas membre du BDE cette année.",
          },
        ],
      },
    );
  }
}

/** Public page: active partners only, never contacts nor notes. */
export function listPublicPartners(ctx: Pick<AuthedCtx, "db">) {
  return findActivePartners(ctx.db);
}

export async function listPartners(ctx: AuthedCtx): Promise<PartnerDto[]> {
  return (await findPartners(ctx.db)).map((row) => toDto(ctx, row));
}

export async function getPartner(ctx: AuthedCtx, partnerId: string): Promise<PartnerDto> {
  const row = await findPartner(ctx.db, partnerId);
  if (!row) throw notFound();
  return toDto(ctx, row);
}

export async function createPartner(ctx: AuthedCtx, input: CreatePartnerData) {
  await assertOwner(ctx, input.ownerMembershipId);
  const id = await insertPartner(ctx.db, { ...input, createdBy: ctx.user.id });
  return getPartner(ctx, id);
}

export async function updatePartner(ctx: AuthedCtx, partnerId: string, input: UpdatePartnerData) {
  const row = await findPartner(ctx.db, partnerId);
  if (!row) throw notFound();
  if (!canEdit(ctx, row))
    throw new AppError("FORBIDDEN", 403, "Tu n'as pas les droits pour faire ça.");
  // Only the board reassigns a partner to another member.
  if (input.ownerMembershipId !== undefined && !ctx.permissions.has("partners:manage")) {
    throw new AppError("FORBIDDEN", 403, "Seul le bureau change le référent d'un partenaire.");
  }
  await assertOwner(ctx, input.ownerMembershipId);
  await updatePartnerRow(ctx.db, row.partner.id, input);
  return getPartner(ctx, row.partner.id);
}

export async function deletePartner(ctx: AuthedCtx, partnerId: string, now: Date = new Date()) {
  const row = await findPartner(ctx.db, partnerId);
  if (!row) throw notFound();
  await inTransaction(ctx.db, async (tx) => {
    await updatePartnerRow(tx, row.partner.id, { deletedAt: now });
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "partner.deleted",
      entity: "partner",
      entityId: row.partner.id,
      payload: { name: row.partner.name },
    });
  });
}
