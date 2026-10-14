import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeSignIn } from "./code-sign-in";

const sendOtp = vi.hoisted(() => vi.fn());
const signInOtp = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { emailOtp: { sendVerificationOtp: sendOtp }, signIn: { emailOtp: signInOtp } },
}));

async function requestCode(next?: string) {
  const user = userEvent.setup();
  render(<CodeSignIn next={next} />);
  await user.type(screen.getByLabelText("Adresse email de l'école"), " jeanne@myskolae.fr ");
  await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
  return user;
}

describe("CodeSignIn", () => {
  beforeEach(() => {
    sendOtp.mockReset().mockResolvedValue({ data: { success: true } });
    signInOtp.mockReset();
    push.mockReset();
  });

  it("asks for a sign-in code, then signs in and goes back to the requested page", async () => {
    signInOtp.mockResolvedValueOnce({ data: {} });
    const user = await requestCode("/tickets/123");
    expect(sendOtp).toHaveBeenCalledWith({ email: "jeanne@myskolae.fr", type: "sign-in" });
    expect(await screen.findByText("jeanne@myskolae.fr")).toBeInTheDocument();

    const code = screen.getByLabelText("Code reçu par mail");
    await user.type(code, "12 34a56");
    expect(code).toHaveValue("123456");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(signInOtp).toHaveBeenCalledWith({ email: "jeanne@myskolae.fr", otp: "123456" });
    expect(push).toHaveBeenCalledWith("/tickets/123");
  });

  it("shows a wrong code in French and stays on the page", async () => {
    signInOtp.mockResolvedValueOnce({ error: { code: "INVALID_OTP", status: 400 } });
    const user = await requestCode();
    await user.type(await screen.findByLabelText("Code reçu par mail"), "000000");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.");
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the submit disabled until the 6 digits are typed", async () => {
    const user = await requestCode();
    await user.type(await screen.findByLabelText("Code reçu par mail"), "123");
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeDisabled();
  });
});
