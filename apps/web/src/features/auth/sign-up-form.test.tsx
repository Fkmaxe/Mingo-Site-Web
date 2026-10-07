import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const signUp = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signUp: { email: signUp } } }));

describe("SignUpForm", () => {
  it("refuses another domain before calling the API", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);
    await user.type(screen.getByLabelText("Prénom et nom"), "Jeanne Durand");
    await user.type(screen.getByLabelText("Adresse email de l'école"), "jeanne@gmail.com");
    await user.type(screen.getByLabelText(/^Mot de passe/), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByText("Utilise ton adresse @myskolae.fr")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse email de l'école")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows the French message of an API error", async () => {
    signUp.mockResolvedValueOnce({ error: { code: "DOMAIN_NOT_ALLOWED", status: 403 } });
    const user = userEvent.setup();
    render(<SignUpForm />);
    await user.type(screen.getByLabelText("Prénom et nom"), "Jeanne Durand");
    await user.type(screen.getByLabelText("Adresse email de l'école"), "jeanne@myskolae.fr");
    await user.type(screen.getByLabelText(/^Mot de passe/), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("@myskolae.fr");
  });
});
