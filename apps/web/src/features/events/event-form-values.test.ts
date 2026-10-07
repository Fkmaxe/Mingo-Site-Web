import { describe, expect, it } from "vitest";
import { emptyEventForm, eventFormResolver, formToInput } from "./event-form-values";

const filled = {
  ...emptyEventForm("0b7f1f0e-6a59-4c8a-9a5d-3a1d6c3c2f10"),
  title: "Soirée jeux",
  location: "Foyer",
  startsAt: "2026-12-10T19:00",
  endsAt: "2026-12-10T23:00",
};

describe("event form", () => {
  it("converts Paris times and empty optional fields", () => {
    expect(formToInput(filled)).toMatchObject({
      startsAt: "2026-12-10T18:00:00.000Z",
      endsAt: "2026-12-10T22:00:00.000Z",
      registrationDeadline: null,
      capacity: null,
      openPointsValue: 0,
    });
  });

  it("validates with the shared schema and French messages", () => {
    expect(eventFormResolver(filled).errors).toEqual({});
    const { errors } = eventFormResolver({
      ...filled,
      endsAt: "2026-12-10T18:00",
      capacity: "abc",
      poleId: "",
    });
    expect(errors.endsAt?.message).toBe("La fin doit être après le début");
    expect(errors.capacity?.message).toBe("La capacité doit être un nombre entier");
    expect(errors.poleId?.message).toBe("Choisis un pôle");
  });
});
