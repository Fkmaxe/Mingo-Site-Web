import { describe, expect, it } from "vitest";
import { canUnregister, newQrToken, registrationState } from "./rules";

const now = new Date("2026-11-01T12:00:00Z");
const base = {
  status: "published" as const,
  startsAt: new Date("2026-11-10T19:00:00Z"),
  endsAt: new Date("2026-11-10T23:00:00Z"),
  registrationDeadline: null,
  capacity: 2,
};

describe("registrationState", () => {
  it("is open for a published event with room left", () => {
    expect(registrationState(base, 1, now)).toBe("open");
  });

  it("is full when confirmed registrations reach the capacity", () => {
    expect(registrationState(base, 2, now)).toBe("full");
    expect(registrationState({ ...base, capacity: null }, 500, now)).toBe("open");
  });

  it("is closed for drafts and cancelled events", () => {
    expect(registrationState({ ...base, status: "draft" }, 0, now)).toBe("closed");
    expect(registrationState({ ...base, status: "cancelled" }, 0, now)).toBe("closed");
  });

  it("closes after the deadline, or after the end without deadline", () => {
    const deadline = new Date("2026-10-31T23:59:00Z");
    expect(registrationState({ ...base, registrationDeadline: deadline }, 0, now)).toBe("closed");
    expect(registrationState(base, 0, new Date("2026-11-10T21:00:00Z"))).toBe("open");
    expect(registrationState(base, 0, new Date("2026-11-11T00:00:00Z"))).toBe("closed");
  });
});

describe("canUnregister", () => {
  it("allows unregistering until the start only", () => {
    expect(canUnregister(base, now)).toBe(true);
    expect(canUnregister(base, new Date("2026-11-10T19:00:00Z"))).toBe(false);
  });
});

describe("newQrToken", () => {
  it("is 32 random bytes in base64url", () => {
    const token = newQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newQrToken()).not.toBe(token);
  });
});
