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

describe("team sizes in the event form", () => {
  it("is individual when both are empty, a team event otherwise", () => {
    expect(formToInput(filled)).toMatchObject({ teamMinSize: null, teamMaxSize: null });
    expect(formToInput({ ...filled, teamMinSize: "2", teamMaxSize: "5" })).toMatchObject({
      teamMinSize: 2,
      teamMaxSize: 5,
    });
  });

  it("reports a missing or inconsistent size", () => {
    expect(eventFormResolver({ ...filled, teamMaxSize: "5" }).errors.teamMinSize?.message).toBe(
      "Indique la taille minimale",
    );
    const { errors } = eventFormResolver({ ...filled, teamMinSize: "4", teamMaxSize: "2" });
    expect(errors.teamMaxSize?.message).toBe("Le maximum doit être au moins égal au minimum");
  });
});

describe("custom fields in the event form", () => {
  it("keeps existing keys, derives unique keys for new fields, splits choices", () => {
    const input = formToInput({
      ...filled,
      customFields: [
        { key: "taille", label: "Taille", type: "select", required: true, options: "S\n M \n\nL" },
        { key: "", label: "Régime", type: "text", required: false, options: "" },
        { key: "", label: "Régime", type: "text", required: false, options: "ignored" },
      ],
    });
    expect(input.customFields).toEqual([
      { key: "taille", label: "Taille", type: "select", required: true, options: ["S", "M", "L"] },
      { key: "regime", label: "Régime", type: "text", required: false },
      { key: "regime_2", label: "Régime", type: "text", required: false },
    ]);
  });

  it("reports a select without enough choices", () => {
    const { errors } = eventFormResolver({
      ...filled,
      customFields: [{ key: "", label: "Taille", type: "select", required: true, options: "S" }],
    });
    expect(errors.customFields?.message).toBe("Champ 1 : Indique au moins 2 choix");
  });
});
