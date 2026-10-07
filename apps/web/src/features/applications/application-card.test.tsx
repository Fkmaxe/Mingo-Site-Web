import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApplicationCard } from "./application-card";
import type { Application } from "./types";

const decideApplicationAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ decideApplicationAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const application: Application = {
  id: "a1",
  status: "new",
  motivation: "J'aime le sport.",
  wishedPole: { id: "sport", name: "Sport" },
  user: { id: "u1", name: "Jeanne", email: "jeanne@myskolae.fr", promo: "2A" },
  createdAt: "2026-10-01T10:00:00.000Z",
};
const poles = [
  { id: "sport", name: "Sport" },
  { id: "com", name: "Communication" },
];

describe("ApplicationCard", () => {
  it("accepts in the chosen pole", async () => {
    decideApplicationAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ApplicationCard application={application} poles={poles} />);
    await user.selectOptions(screen.getByLabelText("Pôle d'affectation"), "com");
    await user.click(screen.getByRole("button", { name: "Accepter" }));
    expect(decideApplicationAction).toHaveBeenCalledWith("a1", { kind: "accept", poleId: "com" });
  });

  it("offers no action once decided", () => {
    render(<ApplicationCard application={{ ...application, status: "accepted" }} poles={poles} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
