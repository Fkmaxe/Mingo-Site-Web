import { z } from "zod";
import { BOARD_POSITIONS, MEMBERSHIP_ROLES, PARTNER_STATUSES } from "../enums";

const PartnerFields = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(120, "Nom trop long"),
  website: z.url("Adresse de site invalide").nullable(),
  contactName: z.string().trim().max(120, "Nom trop long"),
  contactEmail: z.email("Email invalide").nullable(),
  status: z.enum(PARTNER_STATUSES, "Statut invalide"),
  /** Public: what students get (discounts…). */
  benefits: z.string().trim().max(2000, "Texte trop long"),
  /** Internal notes. */
  notes: z.string().trim().max(5000, "Notes trop longues"),
  /** Member in charge of the partner (current school year). */
  ownerMembershipId: z.uuid("Référent invalide").nullable(),
});

export const CreatePartnerInput = PartnerFields.extend({
  website: PartnerFields.shape.website.default(null),
  contactName: PartnerFields.shape.contactName.default(""),
  contactEmail: PartnerFields.shape.contactEmail.default(null),
  status: PartnerFields.shape.status.default("prospect"),
  benefits: PartnerFields.shape.benefits.default(""),
  notes: PartnerFields.shape.notes.default(""),
  ownerMembershipId: PartnerFields.shape.ownerMembershipId.default(null),
}).meta({ id: "CreatePartnerInput" });
export type CreatePartnerData = z.output<typeof CreatePartnerInput>;

export const UpdatePartnerInput = PartnerFields.partial().meta({ id: "UpdatePartnerInput" });
export type UpdatePartnerData = z.output<typeof UpdatePartnerInput>;

export const PublicPartnerDto = z
  .object({ id: z.uuid(), name: z.string(), website: z.string().nullable(), benefits: z.string() })
  .meta({ id: "PublicPartner" });

export const PartnerDto = z
  .object({
    id: z.uuid(),
    name: z.string(),
    website: z.string().nullable(),
    contactName: z.string(),
    contactEmail: z.string().nullable(),
    status: z.enum(PARTNER_STATUSES),
    benefits: z.string(),
    notes: z.string(),
    owner: z.object({ membershipId: z.uuid(), name: z.string() }).nullable(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "Partner" });
export type PartnerDto = z.infer<typeof PartnerDto>;

/** Directory of the BDE (docs/context.md: pôle, rôle, promo, contact). */
export const MemberDirectoryEntryDto = z
  .object({
    membershipId: z.uuid(),
    role: z.enum(MEMBERSHIP_ROLES),
    boardPosition: z.enum(BOARD_POSITIONS).nullable(),
    pole: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    user: z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.string(),
      promo: z.string().nullable(),
    }),
  })
  .meta({ id: "MemberDirectoryEntry" });
export type MemberDirectoryEntryDto = z.infer<typeof MemberDirectoryEntryDto>;
