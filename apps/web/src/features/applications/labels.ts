import type { ApplicationStatus } from "@bde/shared";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "Nouvelle",
  interview: "Entretien",
  accepted: "Acceptée",
  rejected: "Refusée",
};
