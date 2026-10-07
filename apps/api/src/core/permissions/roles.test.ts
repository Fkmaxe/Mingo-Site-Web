import { describe, expect, it } from "vitest";
import { resolveRoles } from "./roles";

const notAdmin = { isAdmin: false };

describe("resolveRoles", () => {
  it("makes a user without membership a student", () => {
    expect(resolveRoles(notAdmin, [])).toEqual(["student"]);
  });

  it("makes a pole member a student and a member", () => {
    expect(resolveRoles(notAdmin, [{ poleId: "p1", role: "member", boardPosition: null }])).toEqual(
      ["student", "member"],
    );
  });

  it("makes a pole lead also a member", () => {
    expect(
      resolveRoles(notAdmin, [{ poleId: "p1", role: "pole_lead", boardPosition: null }]),
    ).toEqual(["student", "member", "pole_lead"]);
  });

  it("derives treasurer from the board position", () => {
    expect(
      resolveRoles(notAdmin, [{ poleId: null, role: "board", boardPosition: "treasurer" }]),
    ).toEqual(["student", "member", "board", "treasurer"]);
  });

  it("adds admin from the user flag, independently of memberships", () => {
    expect(resolveRoles({ isAdmin: true }, [])).toEqual(["student", "admin"]);
  });

  it("cumulates roles from several memberships", () => {
    expect(
      resolveRoles(notAdmin, [
        { poleId: "p1", role: "member", boardPosition: null },
        { poleId: "p2", role: "pole_lead", boardPosition: null },
      ]),
    ).toEqual(["student", "member", "pole_lead"]);
  });
});
