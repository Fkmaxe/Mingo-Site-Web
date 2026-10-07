import { describe, expect, it } from "vitest";
import { APP_ROLES } from "./enums";
import { DEFAULT_ROLE_PERMISSIONS, isPermission, PERMISSIONS } from "./permissions";

describe("permissions", () => {
  it("has unique permissions in resource:action format", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const permission of PERMISSIONS) expect(permission).toMatch(/^[a-z-]+:[a-z_]+$/);
  });

  it("gives every role a default mapping without duplicates", () => {
    for (const role of APP_ROLES) {
      const permissions = DEFAULT_ROLE_PERMISSIONS[role];
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  it("keeps budget to the treasurer and validations to the board", () => {
    const holders = (p: (typeof PERMISSIONS)[number]) =>
      APP_ROLES.filter((role) => DEFAULT_ROLE_PERMISSIONS[role].includes(p));
    expect(holders("budget:manage")).toEqual(["treasurer"]);
    expect(holders("open-points:validate")).toEqual(["board"]);
    expect(holders("grades:validate")).toEqual(["board"]);
    expect(holders("poles:all")).toEqual(["board"]);
  });

  it("recognises permission strings", () => {
    expect(isPermission("checkin:scan")).toBe(true);
    expect(isPermission("checkin:hack")).toBe(false);
  });
});
