import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MembersAdmin } from "./members-admin";
import type { AdminUser, Pole } from "./types";

const actions = vi.hoisted(() => ({
  setMembershipAction: vi.fn(async () => ({ ok: true as const })),
  removeMembershipAction: vi.fn(),
  setAdminAction: vi.fn(),
}));
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const poles: Pole[] = [
  { id: "com", slug: "com", name: "Communication", description: null },
  { id: "event", slug: "event", name: "Événementiel", description: null },
];
const alex: AdminUser = {
  id: "u1",
  name: "Alex",
  email: "alex@myskolae.fr",
  promo: null,
  isAdmin: true,
  memberships: [
    { id: "m1", role: "board", boardPosition: "treasurer", pole: null },
    {
      id: "m2",
      role: "pole_lead",
      boardPosition: null,
      pole: { id: "com", name: "Communication" },
    },
  ],
};

async function openForm() {
  render(<MembersAdmin users={[alex]} poles={poles} meId="other" />);
  await userEvent.click(screen.getByRole("button", { name: /Ajouter un rôle/ }));
}

describe("adding a role", () => {
  it("adds a role in another pole, keeping the others", async () => {
    await openForm();
    await userEvent.selectOptions(screen.getByLabelText("Pôle"), "event");
    expect(screen.getByText("S'ajoute à ses rôles actuels.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajouter ce rôle" }));
    expect(actions.setMembershipAction).toHaveBeenCalledWith({
      userId: "u1",
      role: "member",
      poleId: "event",
      boardPosition: null,
    });
  });

  it("says when it replaces the role in the same pole or the board seat", async () => {
    await openForm();
    await userEvent.selectOptions(screen.getByLabelText("Pôle"), "com");
    expect(screen.getByRole("button", { name: "Remplacer ce rôle" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rôle"), "board");
    expect(screen.getByText(/Remplace « Bureau · Trésorier·e »/)).toBeInTheDocument();
  });
});
