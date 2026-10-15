/** Single source of truth for enums: the Drizzle schema builds its Postgres enums from these. */

export const MEMBERSHIP_ROLES = ["member", "pole_lead", "board"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const BOARD_POSITIONS = ["president", "vice_president", "secretary", "treasurer"] as const;
export type BoardPosition = (typeof BOARD_POSITIONS)[number];

/**
 * Roles used for RBAC (`role_permission`). Derived per request from the user and their
 * memberships of the current school year: everyone is a `student`, `treasurer` comes from
 * `board_position`, `admin` from `user.is_admin`.
 */
export const APP_ROLES = ["student", "member", "pole_lead", "board", "treasurer", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const EVENT_VISIBILITIES = ["public", "students", "members"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_STATUSES = ["draft", "published", "cancelled", "done"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const REGISTRATION_STATUSES = ["confirmed", "waitlisted", "cancelled"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Whether a user can register now. Computed by the API from the event and its registrations. */
export const REGISTRATION_STATES = ["open", "full", "closed"] as const;
export type RegistrationState = (typeof REGISTRATION_STATES)[number];

export const ATTENDANCE_KINDS = ["participant", "staff", "meeting"] as const;
export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];

export const OPEN_POINTS_STATUSES = ["pending", "validated", "rejected", "exported"] as const;
export type OpenPointsStatus = (typeof OPEN_POINTS_STATUSES)[number];

export const OPEN_POINTS_SOURCES = ["auto", "manual"] as const;
export type OpenPointsSource = (typeof OPEN_POINTS_SOURCES)[number];

export const STAFF_ASSIGNMENT_STATUSES = ["proposed", "validated", "declined"] as const;
export type StaffAssignmentStatus = (typeof STAFF_ASSIGNMENT_STATUSES)[number];

export const GRADE_STATUSES = ["draft", "submitted", "validated", "published"] as const;
export type GradeStatus = (typeof GRADE_STATUSES)[number];

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Board of a pole, of the bureau, or personal (seen only by its author). */
export const TASK_SCOPES = ["pole", "board", "personal"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

/**
 * Who a meeting is for: a pole, the whole BDE (general), the bureau alone, or the bureau with
 * the pole leads.
 */
export const MEETING_KINDS = ["pole", "general", "board", "leads"] as const;
export type MeetingKind = (typeof MEETING_KINDS)[number];

export const APPLICATION_STATUSES = ["new", "interview", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PARTNER_STATUSES = [
  "prospect",
  "contacted",
  "negotiating",
  "active",
  "ended",
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** State of an inventory item, from best to worst. */
export const ITEM_CONDITIONS = ["new", "good", "worn", "damaged", "broken"] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

/** unique: one object (a speaker); stock: a quantity of the same thing (cups). */
export const ITEM_KINDS = ["unique", "stock"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** Entries of the inventory history (append-only). */
export const INVENTORY_ACTIONS = [
  "created",
  "updated",
  "moved",
  "condition_changed",
  "quantity_adjusted",
  "photo_changed",
  "checked_out",
  "returned",
  "archived",
  "restored",
] as const;
export type InventoryAction = (typeof INVENTORY_ACTIONS)[number];

/** Pools then knockout bracket, pools only, or knockout bracket only. */
export const TOURNAMENT_FORMATS = ["pools_bracket", "pools", "bracket"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

/** Pool matches being played, knockout matches being played, all matches played. */
export const TOURNAMENT_STATUSES = ["pools", "bracket", "done"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TOURNAMENT_PHASES = ["pool", "bracket", "third_place"] as const;
export type TournamentPhase = (typeof TOURNAMENT_PHASES)[number];

/** League ledger: a correction cancels the previous points of the event (`reversal`). */
export const LEAGUE_POINTS_REASONS = ["participation", "placement", "reversal"] as const;
export type LeaguePointsReason = (typeof LEAGUE_POINTS_REASONS)[number];

/** Initial training or work-study (alternance). From some years on, work-study only. */
export const STUDY_RHYTHMS = ["initial", "alternance"] as const;
export type StudyRhythm = (typeof STUDY_RHYTHMS)[number];

/** Treasury entry: money out (debit), money in (credit), or another kind named by the treasurer. */
export const TREASURY_KINDS = ["debit", "credit", "other"] as const;
export type TreasuryKind = (typeof TREASURY_KINDS)[number];

/** Direction of an « other » treasury entry: money in or out. */
export const TREASURY_DIRECTIONS = ["in", "out"] as const;
export type TreasuryDirection = (typeof TREASURY_DIRECTIONS)[number];
