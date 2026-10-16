import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalendarItem } from "./types";
import { WeekAhead } from "./week-ahead";

const item = (id: string, day: string, kind: CalendarItem["kind"] = "event"): CalendarItem => ({
  id,
  kind,
  title: `Élément ${id}`,
  day,
  allDay: kind === "task",
  startsAt: kind === "task" ? null : `${day}T17:00:00.000Z`,
  endsAt: kind === "task" ? null : `${day}T19:00:00.000Z`,
  location: "",
  label: "Pôle Sport",
  cancelled: false,
  path: `/x/${id}`,
});

describe("WeekAhead", () => {
  it("says today and tomorrow, shows 5 items and counts the rest", () => {
    const items = [
      item("a", "2026-10-16"),
      item("b", "2026-10-17", "task"),
      ...["c", "d", "e", "f"].map((id) => item(id, "2026-10-19")),
    ];
    render(<WeekAhead items={items} today="2026-10-16" />);
    expect(screen.getByText(/^aujourd'hui · /)).toBeInTheDocument();
    expect(screen.getByText("demain · Délai · Pôle Sport")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Élément/ })).toHaveLength(5);
    expect(screen.getByText("Et 1 de plus dans le calendrier.")).toBeInTheDocument();
  });

  it("has a friendly empty state", () => {
    render(<WeekAhead items={[]} today="2026-10-16" />);
    expect(screen.getByText("Rien de prévu dans les 7 prochains jours.")).toBeInTheDocument();
  });
});
