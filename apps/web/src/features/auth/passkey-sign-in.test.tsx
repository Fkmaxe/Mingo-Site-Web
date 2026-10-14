import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasskeySignIn } from "./passkey-sign-in";

const signInPasskey = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { passkey: signInPasskey } } }));

describe("PasskeySignIn", () => {
  beforeEach(() => {
    push.mockReset();
    signInPasskey.mockReset();
    vi.stubGlobal("PublicKeyCredential", {
      isConditionalMediationAvailable: () => Promise.resolve(true),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts the autofill ceremony once, not again when the button re-renders", async () => {
    // The autofill ceremony waits for the user; the button's one succeeds.
    signInPasskey.mockImplementation((options?: { autoFill?: boolean }) =>
      options?.autoFill ? new Promise(() => {}) : Promise.resolve({ data: {} }),
    );
    const user = userEvent.setup();
    render(<PasskeySignIn next="/ligue" />);
    await user.click(await screen.findByRole("button", { name: /passkey/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/ligue"));
    const autofills = signInPasskey.mock.calls.filter(([options]) => options?.autoFill);
    expect(autofills).toHaveLength(1);
    expect(signInPasskey).toHaveBeenCalledTimes(2);
  });

  it("shows why the passkey sign-in failed", async () => {
    signInPasskey.mockImplementation((options?: { autoFill?: boolean }) =>
      options?.autoFill
        ? new Promise(() => {})
        : Promise.resolve({ error: { code: "ERROR_INVALID_RP_ID", status: 400 } }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<PasskeySignIn />);
    await user.click(await screen.findByRole("button", { name: /passkey/ }));
    expect(
      await screen.findByText("Les passkeys ne fonctionnent pas sur cette adresse du site."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
