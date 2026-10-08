import { describe, expect, it } from "vitest";
import { base64UrlToBytes } from "./browser";

describe("base64UrlToBytes", () => {
  it("decodes base64url without padding", () => {
    // "hi?" -> base64 "aGk/" -> base64url "aGk_"
    expect([...base64UrlToBytes("aGk_")]).toEqual([104, 105, 63]);
    expect([...base64UrlToBytes("aGk")]).toEqual([104, 105]);
  });
});
