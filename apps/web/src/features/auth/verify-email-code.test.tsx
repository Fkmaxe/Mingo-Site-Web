import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailCode } from "./verify-email-code";

const verifyEmail = vi.hoisted(() => vi.fn());
const sendOtp = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { emailOtp: { verifyEmail, sendVerificationOtp: sendOtp } },
}));

describe("VerifyEmailCode", () => {
  beforeEach(() => {
    verifyEmail.mockReset();
    sendOtp.mockReset().mockResolvedValue({ data: { success: true } });
    push.mockReset();
  });

  it("confirms the address with the code, then the onboarding leads to the requested page", async () => {
    verifyEmail.mockResolvedValueOnce({ data: { status: true } });
    const user = userEvent.setup();
    render(<VerifyEmailCode email="jeanne@myskolae.fr" next="/events/gala" />);
    expect(screen.queryByLabelText("Adresse email de l'école")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Code reçu par mail"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmer mon adresse" }));
    expect(verifyEmail).toHaveBeenCalledWith({ email: "jeanne@myskolae.fr", otp: "654321" });
    expect(push).toHaveBeenCalledWith("/welcome?next=%2Fevents%2Fgala");
  });

  it("asks for the address when the page has none, and sends a new code", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailCode />);
    await user.type(screen.getByLabelText("Adresse email de l'école"), "jeanne@myskolae.fr");
    await user.click(screen.getByRole("button", { name: "Pas reçu ? Renvoyer un code" }));
    expect(sendOtp).toHaveBeenCalledWith({
      email: "jeanne@myskolae.fr",
      type: "email-verification",
    });
    expect(
      await screen.findByText("Nouveau code envoyé à jeanne@myskolae.fr."),
    ).toBeInTheDocument();
  });

  it("explains an expired code", async () => {
    verifyEmail.mockResolvedValueOnce({ error: { code: "OTP_EXPIRED", status: 400 } });
    const user = userEvent.setup();
    render(<VerifyEmailCode email="jeanne@myskolae.fr" />);
    await user.type(screen.getByLabelText("Code reçu par mail"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmer mon adresse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce code a expiré");
    expect(push).not.toHaveBeenCalled();
  });
});
