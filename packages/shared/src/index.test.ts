import { describe, expect, it } from "vitest";
import { APP_NAME } from "./index";

describe("@bde/shared", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("BDE Mingo");
  });
});
