import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./share-button";

describe("ShareButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the share sheet with the event's link where the device has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    const user = userEvent.setup();
    render(<ShareButton slug="tournoi-smash" title="Tournoi Smash" />);
    await user.click(screen.getByRole("button", { name: "Partager l'événement" }));
    expect(share).toHaveBeenCalledWith({
      title: "Tournoi Smash",
      url: `${window.location.origin}/events/tournoi-smash`,
    });
  });

  it("copies the link otherwise", async () => {
    // After setup(): user-event installs its own clipboard.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    render(<ShareButton slug="tournoi-smash" title="Tournoi Smash" />);
    await user.click(screen.getByRole("button", { name: "Partager l'événement" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/events/tournoi-smash`);
    expect(await screen.findByText("Lien copié")).toBeInTheDocument();
  });
});
