import { describe, expect, it } from "vitest";
import { CreateEventInput, UpdateEventInput } from "./events";

const valid = {
  poleId: "0b7f1f0e-6a59-4c8a-9a5d-3a1d6c3c2f10",
  title: "Soirée d'intégration",
  location: "Le Bar du coin",
  startsAt: "2026-10-15T19:00:00.000Z",
  endsAt: "2026-10-15T23:00:00.000Z",
  visibility: "students",
};

describe("CreateEventInput", () => {
  it("applies defaults", () => {
    expect(CreateEventInput.parse(valid)).toMatchObject({
      description: "",
      capacity: null,
      registrationDeadline: null,
      openPointsValue: 0,
      posterUrl: null,
    });
  });

  it("rejects an end before the start", () => {
    const result = CreateEventInput.safeParse({ ...valid, endsAt: "2026-10-15T18:00:00.000Z" });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["endsAt"],
      message: "La fin doit être après le début",
    });
  });

  it("rejects a deadline after the end", () => {
    const result = CreateEventInput.safeParse({
      ...valid,
      registrationDeadline: "2026-10-16T00:00:00.000Z",
    });
    expect(result.error?.issues[0]?.path).toEqual(["registrationDeadline"]);
  });

  it("rejects a non-positive capacity and negative points", () => {
    expect(CreateEventInput.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
    expect(CreateEventInput.safeParse({ ...valid, openPointsValue: -1 }).success).toBe(false);
  });
});

describe("UpdateEventInput", () => {
  it("accepts a partial update", () => {
    expect(UpdateEventInput.parse({ title: "Nouveau titre" })).toEqual({ title: "Nouveau titre" });
  });

  it("checks dates when both are given", () => {
    expect(
      UpdateEventInput.safeParse({
        startsAt: "2026-10-15T19:00:00.000Z",
        endsAt: "2026-10-15T19:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
