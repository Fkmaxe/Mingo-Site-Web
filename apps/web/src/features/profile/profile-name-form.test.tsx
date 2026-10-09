import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileNameForm } from "./profile-name-form";

const updateProfileAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ updateProfileAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ProfileNameForm", () => {
  it("saves the new first and last name", async () => {
    updateProfileAction.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<ProfileNameForm firstName="Jeanne" lastName="Durant" />);
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText("Nom"));
    await user.type(screen.getByLabelText("Nom"), "Durand");
    await user.click(save);

    expect(updateProfileAction).toHaveBeenCalledWith({ firstName: "Jeanne", lastName: "Durand" });
    expect(await screen.findByRole("status")).toHaveTextContent("C'est enregistré.");
  });

  it("refuses an empty first name before calling the API", async () => {
    updateProfileAction.mockReset();
    const user = userEvent.setup();
    render(<ProfileNameForm firstName="Jeanne" lastName="Durand" />);
    await user.clear(screen.getByLabelText("Prénom"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Le prénom est obligatoire")).toBeInTheDocument();
    expect(updateProfileAction).not.toHaveBeenCalled();
  });

  it("shows the API error on the field", async () => {
    updateProfileAction.mockResolvedValueOnce({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Données invalides",
      fieldErrors: { lastName: "Le nom doit faire au plus 50 caractères" },
    });
    const user = userEvent.setup();
    render(<ProfileNameForm firstName="Jeanne" lastName="Durand" />);
    await user.type(screen.getByLabelText("Nom"), "x");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Le nom doit faire au plus 50 caractères")).toBeInTheDocument();
  });
});
