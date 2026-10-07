import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav, SideNav } from "./nav";
import { MANAGE_NAV_ITEM, NAV_ITEMS } from "./nav-items";

const pathname = vi.hoisted(() => ({ value: "/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("navigation", () => {
  beforeEach(() => {
    pathname.value = "/home";
  });

  it.each([
    ["bottom", BottomNav],
    ["side", SideNav],
  ])("%s nav lists every item", (_, Nav) => {
    render(<Nav />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("marks the current page, including nested routes", () => {
    pathname.value = "/profile/settings";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });
});

describe("manage entry", () => {
  it("is hidden from non-managers", () => {
    render(<BottomNav />);
    expect(screen.queryByRole("link", { name: MANAGE_NAV_ITEM.label })).toBeNull();
  });

  it("is shown to managers", () => {
    render(<SideNav canManage />);
    expect(screen.getByRole("link", { name: MANAGE_NAV_ITEM.label })).toHaveAttribute(
      "href",
      "/manage",
    );
  });
});
