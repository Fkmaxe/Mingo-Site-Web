import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const signUp = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signUp: { email: signUp } } }));

describe("SignUpForm", () => {
  it("asks for the address before calling the API", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);
    await user.type(screen.getByLabelText("Prénom"), "Jeanne");
    await user.type(screen.getByLabelText("Nom"), "Durand");
    await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByText("Adresse email invalide")).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse email de l'école")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("only takes the identifier: the school domain is fixed", async () => {
    signUp.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();
    render(<SignUpForm />);
    const email = screen.getByLabelText("Adresse email de l'école");
    expect(email).toHaveAttribute("placeholder", "j.dupont");
    expect(screen.getByText("@myskolae.fr")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Prénom"), "Jeanne");
    await user.type(screen.getByLabelText("Nom"), "Durand");
    await user.type(email, "J.Durand@gmail.com");
    await user.tab();
    expect(email).toHaveValue("j.durand");
    await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "j.durand@myskolae.fr" }));
  });

  it("shows the French message of an API error", async () => {
    signUp.mockResolvedValueOnce({ error: { code: "DOMAIN_NOT_ALLOWED", status: 403 } });
    const user = userEvent.setup();
    render(<SignUpForm />);
    await user.type(screen.getByLabelText("Prénom"), "Jeanne");
    await user.type(screen.getByLabelText("Nom"), "Durand");
    await user.type(screen.getByLabelText("Adresse email de l'école"), "jeanne@myskolae.fr");
    await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("@myskolae.fr");
  });

  it("sends first and last name, and the destination for the confirmation link", async () => {
    signUp.mockResolvedValueOnce({ data: {} });
    const user = userEvent.setup();
    render(<SignUpForm next="/events/gala" />);
    await user.type(screen.getByLabelText("Prénom"), " Jeanne ");
    await user.type(screen.getByLabelText("Nom"), "Durand");
    await user.type(screen.getByLabelText("Adresse email de l'école"), "jeanne");
    await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
    await user.type(screen.getByLabelText("Confirme le mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jeanne Durand",
        firstName: "Jeanne",
        lastName: "Durand",
        callbackURL: "/events/gala",
      }),
    );
    expect(push).toHaveBeenCalledWith(
      "/verify-email?email=jeanne%40myskolae.fr&next=%2Fevents%2Fgala",
    );
  });
});
