import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HOME, MANAGE, TREASURY } from "@/lib/breadcrumbs";
import { PageHeader } from "./brand";
import { Breadcrumbs } from "./breadcrumbs";

describe("Breadcrumbs", () => {
  it("links every parent and marks the current page", () => {
    render(<Breadcrumbs items={[HOME, MANAGE, TREASURY]} current="Achat boissons" />);
    const nav = screen.getByRole("navigation", { name: "Fil d'Ariane" });
    const list = within(nav).getByRole("list");
    expect(within(list).getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/home");
    expect(within(list).getByRole("link", { name: "Gestion" })).toHaveAttribute("href", "/manage");
    expect(within(list).getByRole("link", { name: "Trésorerie" })).toHaveAttribute(
      "href",
      "/manage/treasury",
    );
    expect(within(list).getByText("Achat boissons")).toHaveAttribute("aria-current", "page");
  });

  it("offers the parent page as the back link on a phone", () => {
    render(<Breadcrumbs items={[HOME, MANAGE]} current="Trésorerie" />);
    const links = screen.getAllByRole("link", { name: "Gestion" });
    // One in the phone back link, one in the full trail.
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveClass("md:hidden");
  });

  it("renders nothing without a parent", () => {
    const { container } = render(<Breadcrumbs items={[]} current="Accueil" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is shown above the page title by PageHeader", () => {
    render(<PageHeader title="Tâches" breadcrumb={[HOME]} />);
    expect(screen.getByRole("heading", { name: "Tâches" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Fil d'Ariane" })).toBeInTheDocument();
  });
});
