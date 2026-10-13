import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RegistrantsList } from "./registrants-table";
import type { Registrant } from "./types";

let n = 0;
function registrant(
  name: string,
  level: string | null,
  track: string | null,
  rhythm: "initial" | "alternance" | null,
): Registrant {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    status: "confirmed",
    createdAt: "2026-10-01T10:00:00.000Z",
    answers: {},
    team: null,
    user: {
      id: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      name,
      email: `${name.toLowerCase()}@myskolae.fr`,
      promo: [level, track].filter(Boolean).join(" · ") || null,
      level,
      track,
      rhythm,
    },
  };
}

const people = [
  registrant("Alice", "1A", "MCSI", "initial"),
  registrant("Bruno", "1A", "Tronc commun", "alternance"),
  registrant("Chloé", "3A", "Sécurité", "alternance"),
  registrant("Driss", null, null, null),
];

describe("RegistrantsList", () => {
  it("filters by year, programme and rhythm", async () => {
    const user = userEvent.setup();
    render(<RegistrantsList registrants={people} fields={[]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    await user.selectOptions(screen.getByLabelText("Année"), "1A");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bruno"),
    ]);
    await user.selectOptions(screen.getByLabelText("Rythme"), "alternance");
    expect(screen.getByRole("status")).toHaveTextContent("1 inscrit dans cette sélection");
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });

  it("finds who did not fill in their class", async () => {
    const user = userEvent.setup();
    render(<RegistrantsList registrants={people} fields={[]} />);
    await user.selectOptions(screen.getByLabelText("Filière"), "Non renseigné");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Driss")).toBeInTheDocument();
  });
});
