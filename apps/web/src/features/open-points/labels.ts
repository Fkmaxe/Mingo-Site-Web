import type { OpenPointsStatus } from "@bde/shared";

export const OPEN_POINTS_STATUS_LABELS: Record<OpenPointsStatus, string> = {
  pending: "En attente de validation",
  validated: "Validé",
  rejected: "Refusé",
  exported: "Transmis à l'école",
};

export function formatPoints(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n} pt${Math.abs(n) > 1 ? "s" : ""}`;
}
