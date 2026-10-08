import { describe, expect, it } from "vitest";
import { compact } from "./patch";

describe("compact", () => {
  it("drops undefined fields but keeps null (an explicit clear)", () => {
    expect(compact({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it("returns null when nothing is left to update", () => {
    expect(compact({ a: undefined })).toBeNull();
    expect(compact({})).toBeNull();
  });
});
