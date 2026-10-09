import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const signIn = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: signIn } } }));

async function submit(next?: string) {
  const user = userEvent.setup();
  render(<SignInForm next={next} />);
  await user.type(screen.getByLabelText("Adresse email"), "jeanne@myskolae.fr");
  await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("SignInForm", () => {
  beforeEach(() => {
    signIn.mockReset();
    push.mockReset();
  });

  it("goes back to the requested page after login", async () => {
    signIn.mockResolvedValueOnce({ data: {} });
    await submit("/tickets/123");
    expect(signIn).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/tickets/123" }));
    expect(push).toHaveBeenCalledWith("/tickets/123");
  });

  it("sends an unverified account to the confirmation page", async () => {
    signIn.mockResolvedValueOnce({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    await submit("/tickets/123");
    expect(push).toHaveBeenCalledWith(
      "/verify-email?email=jeanne%40myskolae.fr&resent=1&next=%2Ftickets%2F123",
    );
  });

  it("shows wrong credentials in French", async () => {
    signIn.mockResolvedValueOnce({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou mot de passe incorrect.");
    expect(push).not.toHaveBeenCalled();
  });

  it("lets the user show the password", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);
    const password = screen.getByLabelText("Mot de passe");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));
    expect(password).toHaveAttribute("type", "text");
  });
});
