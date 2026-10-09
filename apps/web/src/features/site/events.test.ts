import { describe, expect, it } from "vitest";
import { eventPhase, homeSelection, type ShowcaseEvent, showcaseable } from "./events";

const now = new Date("2026-10-09T20:00:00Z");

function makeEvent(overrides: Partial<ShowcaseEvent> = {}): ShowcaseEvent {
  return {
    id: overrides.id ?? "e1",
    slug: "soiree",
    title: "Soirée",
    description: "",
    location: "ESGI",
    startsAt: "2026-10-10T18:00:00Z",
    endsAt: "2026-10-10T23:00:00Z",
    status: "published",
    posterUrl: null,
    ...overrides,
  };
}

describe("eventPhase", () => {
  it.each([
    ["upcoming", "2026-10-10T18:00:00Z", "2026-10-10T23:00:00Z"],
    ["ongoing", "2026-10-09T19:00:00Z", "2026-10-09T23:00:00Z"],
    ["ongoing", "2026-10-09T20:00:00Z", "2026-10-09T23:00:00Z"],
    ["past", "2026-10-09T17:00:00Z", "2026-10-09T20:00:00Z"],
    ["past", "2026-06-06T17:00:00Z", "2026-06-06T23:00:00Z"],
  ])("%s for %s → %s", (expected, startsAt, endsAt) => {
    expect(eventPhase(makeEvent({ startsAt, endsAt }), now)).toBe(expected);
  });

  it("says cancelled whatever the dates", () => {
    expect(eventPhase(makeEvent({ status: "cancelled" }), now)).toBe("cancelled");
  });

  it("treats a done event by its dates", () => {
    const done = makeEvent({
      status: "done",
      startsAt: "2026-10-01T18:00:00Z",
      endsAt: "2026-10-01T23:00:00Z",
    });
    expect(eventPhase(done, now)).toBe("past");
  });
});

describe("showcaseable", () => {
  it("never shows drafts", () => {
    const events = [makeEvent({ id: "a" }), makeEvent({ id: "b", status: "draft" })];
    expect(showcaseable(events).map((e) => e.id)).toEqual(["a"]);
  });
});

describe("homeSelection", () => {
  it("shows what is coming, without cancelled events", () => {
    const current = [
      makeEvent({ id: "a" }),
      makeEvent({ id: "b", status: "cancelled" }),
      makeEvent({ id: "c" }),
      makeEvent({ id: "d" }),
      makeEvent({ id: "e" }),
    ];
    expect(homeSelection(current, [makeEvent({ id: "p" })])).toEqual({
      events: [current[0], current[2], current[3]],
      showingPast: false,
    });
  });

  it("falls back to the latest past events", () => {
    const past = [makeEvent({ id: "p1" }), makeEvent({ id: "p2" })];
    expect(homeSelection([makeEvent({ id: "x", status: "cancelled" })], past)).toEqual({
      events: past,
      showingPast: true,
    });
  });
});
