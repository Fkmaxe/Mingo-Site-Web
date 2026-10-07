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
