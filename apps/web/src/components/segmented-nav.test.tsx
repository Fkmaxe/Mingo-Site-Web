import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentedNav } from "./segmented-nav";

describe("SegmentedNav", () => {
  it("links every tab and marks the current one", () => {
    render(
      <SegmentedNav
        label="Période"
        active="past"
        items={[
          { key: "upcoming", label: "À venir", href: "/events" },
          { key: "past", label: "Passés", href: "/events?scope=past" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Période" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Passés" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "À venir" })).not.toHaveAttribute("aria-current");
  });
});
