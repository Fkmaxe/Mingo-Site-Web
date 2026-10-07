import type { AppRole, BoardPosition, MembershipRole } from "@bde/shared";

export const ROLE_LABELS: Record<AppRole, string> = {
  student: "Étudiant",
  member: "Membre BDE",
  pole_lead: "Responsable de pôle",
  board: "Bureau",
  treasurer: "Trésorier",
  admin: "Admin technique",
};

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  member: "Membre",
  pole_lead: "Responsable",
  board: "Bureau",
};

export const BOARD_POSITION_LABELS: Record<BoardPosition, string> = {
  president: "Président·e",
  vice_president: "Vice-président·e",
  secretary: "Secrétaire",
  treasurer: "Trésorier·e",
};
