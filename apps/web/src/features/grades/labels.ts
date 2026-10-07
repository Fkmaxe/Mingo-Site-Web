import type { GradeStatus } from "@bde/shared";

export const GRADE_STATUS_LABELS: Record<GradeStatus, string> = {
  draft: "Brouillon",
  submitted: "Soumise au bureau",
  validated: "Validée",
  published: "Publiée",
};

export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",").replace(/0$/, "");
}
