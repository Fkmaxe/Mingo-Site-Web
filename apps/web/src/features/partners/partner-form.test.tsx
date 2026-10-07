import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PartnerForm } from "./partner-form";
import type { Partner } from "./types";

const actions = vi.hoisted(() => ({
  createPartnerAction: vi.fn(),
  updatePartnerAction: vi.fn(),
  deletePartnerAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

const partner: Partner = {
  id: "p1",
  name: "Vitalis",
  website: null,
  contactName: "",
  contactEmail: null,
  status: "contacted",
  benefits: "",
  notes: "",
  owner: { membershipId: "m1", name: "Léo" },
  canEdit: true,
  updatedAt: null,
};

describe("PartnerForm", () => {
  it("lets a referent edit without touching the referent", async () => {
    actions.updatePartnerAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PartnerForm partner={partner} />);
    expect(screen.queryByLabelText("Référent")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Statut"), "active");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(actions.updatePartnerAction).toHaveBeenCalled());
    const [, body] = actions.updatePartnerAction.mock.calls[0] ?? [];
    expect(body).toMatchObject({ status: "active" });
    expect(body).not.toHaveProperty("ownerMembershipId");
  });

  it("validates the website and email in French", async () => {
    const user = userEvent.setup();
    render(<PartnerForm owners={[]} />);
    await user.type(screen.getByLabelText("Nom"), "Vitalis");
    await user.type(screen.getByLabelText("Site web"), "pas-un-site");
    await user.click(screen.getByRole("button", { name: "Créer le partenaire" }));
    expect(screen.getByText("Adresse de site invalide")).toBeInTheDocument();
    expect(actions.createPartnerAction).not.toHaveBeenCalled();
  });
});
