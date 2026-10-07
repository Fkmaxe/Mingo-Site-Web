import type { PartnerStatus } from "@bde/shared";

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  prospect: "Piste",
  contacted: "Contacté",
  negotiating: "En négociation",
  active: "Actif",
  ended: "Terminé",
};
