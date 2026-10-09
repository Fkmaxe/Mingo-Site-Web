import { describe, expect, it } from "vitest";
import { authHref, safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each([
    ["/events/gala", "/events/gala"],
    [undefined, "/home"],
    ["", "/home"],
    ["https://evil.example", "/home"],
    ["//evil.example", "/home"],
    ["/\\evil.example", "/home"],
  ])("%s -> %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});

describe("authHref", () => {
  it.each([
    ["/tickets/123", "/login?next=%2Ftickets%2F123"],
    ["/manage/events?tab=past", "/login?next=%2Fmanage%2Fevents%3Ftab%3Dpast"],
    ["/home", "/login"],
    [undefined, "/login"],
    ["//evil.example", "/login"],
  ])("%s -> %s", (next, expected) => {
    expect(authHref("/login", next)).toBe(expected);
  });

  it("keeps extra parameters", () => {
    expect(authHref("/verify-email", "/events/gala", { email: "a@myskolae.fr" })).toBe(
      "/verify-email?email=a%40myskolae.fr&next=%2Fevents%2Fgala",
    );
  });
});
