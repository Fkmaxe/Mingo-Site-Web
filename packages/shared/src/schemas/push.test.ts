import { describe, expect, it } from "vitest";
import { isPushServiceEndpoint } from "./push";

describe("isPushServiceEndpoint", () => {
  it("accepts the browsers' push services over https", () => {
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(
      true,
    );
    expect(isPushServiceEndpoint("https://web.push.apple.com/QGx")).toBe(true);
  });

  it("refuses anything else (no request to internal or arbitrary hosts)", () => {
    expect(isPushServiceEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushServiceEndpoint("https://localhost/push")).toBe(false);
    expect(isPushServiceEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://evilpush.apple.com.example/x")).toBe(false);
    expect(isPushServiceEndpoint("pas une url")).toBe(false);
  });
});
