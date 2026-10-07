import { describe, expect, it } from "vitest";
import type { Event } from "../events/types";
import { placesLabel } from "./places";

const event = (capacity: number | null, confirmedCount: number, waitlistCount = 0) =>
  ({ capacity, confirmedCount, waitlistCount }) as Pick<
    Event,
    "capacity" | "confirmedCount" | "waitlistCount"
  > as Event;

describe("placesLabel", () => {
  it("counts the places left", () => {
    expect(placesLabel(event(10, 9))).toBe("1 place restante sur 10");
    expect(placesLabel(event(10, 3))).toBe("7 places restantes sur 10");
  });

  it("shows the waitlist once full", () => {
    expect(placesLabel(event(10, 10))).toBe("Complet");
    expect(placesLabel(event(10, 10, 4))).toBe("Complet · 4 en liste d'attente");
  });

  it("counts registrations when unlimited", () => {
    expect(placesLabel(event(null, 12))).toBe("12 inscrit·e·s");
  });
});
