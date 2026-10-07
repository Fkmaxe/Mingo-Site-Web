import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

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
