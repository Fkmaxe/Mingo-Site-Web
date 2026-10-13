import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, nameInitials } from "./avatar";

describe("Avatar", () => {
  it("shows the initials without a photo", () => {
    expect(nameInitials("Jeanne de La Tour")).toBe("JT");
    expect(nameInitials("Camille")).toBe("C");
    render(<Avatar name="Léo Martin" url={null} />);
    expect(screen.getByText("LM")).toBeInTheDocument();
  });

  it("shows the photo when there is one", () => {
    const { container } = render(<Avatar name="Léo Martin" url="/avatars/x.jpg" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/avatars/x.jpg");
  });
});
