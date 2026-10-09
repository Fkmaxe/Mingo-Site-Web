import type {
  AppRole,
  BoardPosition,
  EventStatus,
  EventVisibility,
  MembershipRole,
} from "@bde/shared";

export const ROLE_LABELS: Record<AppRole, string> = {
  student: "Étudiant",
  member: "Membre BDE",
  pole_lead: "Responsable de pôle",
  board: "Bureau",
  treasurer: "Trésorier",
  admin: "Administrateur",
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

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  cancelled: "Annulé",
  done: "Terminé",
};

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  public: "Public",
  students: "Élèves connectés",
  members: "Membres du BDE",
};
