import type { AppRole } from "./enums";

/** Every permission of the platform, `resource:action` (docs/api-conventions.md). */
export const PERMISSIONS = [
  "events:register",
  "staff:register",
  "members:read",
  "events:create",
  "events:update",
  "events:delete",
  "registrations:read",
  "checkin:scan",
  "members:manage",
  "tasks:manage",
  "meetings:manage",
  "partners:manage",
  "grades:propose",
  "grades:validate",
  "grades:publish",
  "open-points:validate",
  "open-points:adjust",
  "exports:run",
  "budget:read",
  "budget:manage",
  "stats:read",
  /** Add, edit, move, take out and return equipment. */
  "inventory:manage",
  /** Archive equipment (it leaves the list, its history stays). */
  "inventory:archive",
  /** Acts on every pole. Without it, pole-scoped actions require leading that pole. */
  "poles:all",
  "roles:manage",
  "settings:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Default role -> permissions mapping, inserted on first install. Roles are cumulative
 * (a pole lead is also a member and a student), so each role lists only what it adds.
 * The live mapping is the `role_permission` table.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  student: ["events:register"],
  member: ["staff:register", "members:read", "inventory:manage"],
  pole_lead: [
    "events:create",
    "events:update",
    "events:delete",
    "registrations:read",
    "checkin:scan",
    "members:manage",
    "tasks:manage",
    "meetings:manage",
    "grades:propose",
    "inventory:archive",
  ],
  board: [
    "events:create",
    "events:update",
    "events:delete",
    "registrations:read",
    "checkin:scan",
    "members:manage",
    "tasks:manage",
    "meetings:manage",
    "grades:propose",
    "grades:validate",
    "grades:publish",
    "open-points:validate",
    "open-points:adjust",
    "exports:run",
    "partners:manage",
    "budget:read",
    "stats:read",
    "inventory:archive",
    "poles:all",
  ],
  treasurer: ["budget:read", "budget:manage"],
  admin: ["roles:manage", "settings:manage", "audit:read"],
};
