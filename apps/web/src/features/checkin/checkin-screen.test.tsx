import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CheckinScreen } from "./checkin-screen";

const actions = vi.hoisted(() => ({
  checkinAction: vi.fn(),
  searchCandidatesAction: vi.fn(),
}));
vi.mock("./actions", () => actions);
vi.mock("./qr-scanner", () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button type="button" onClick={() => onScan("tok-1")}>
      simuler un scan
    </button>
  ),
}));

describe("CheckinScreen — manual search", () => {
  it("finds a registrant, checks them in and updates the counter", async () => {
    actions.searchCandidatesAction.mockResolvedValue({
      error: null,
      candidates: [
        {
          registrationId: "r1",
          user: { id: "u1", name: "Jeanne Durand", email: "jeanne@myskolae.fr", promo: "3A" },
          checkedInAt: null,
        },
      ],
    });
    actions.checkinAction.mockResolvedValue({
      outcome: { tone: "success", title: "Jeanne Durand", detail: "Bienvenue ! Promo 3A" },
      stats: { confirmedCount: 10, checkedInCount: 4 },
    });
    const user = userEvent.setup();
    render(<CheckinScreen eventId="e1" initialStats={{ confirmedCount: 10, checkedInCount: 3 }} />);

    expect(screen.getByText("3")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Recherche" }));
    await user.type(screen.getByLabelText("Nom ou email"), "durand");
    await user.click(screen.getByRole("button", { name: "Chercher" }));
    await user.click(await screen.findByRole("button", { name: "Pointer" }));

    expect(actions.searchCandidatesAction).toHaveBeenCalledWith("e1", "durand");
    expect(actions.checkinAction).toHaveBeenCalledWith("e1", { userId: "u1" });
    expect(await screen.findByRole("status")).toHaveTextContent("Jeanne Durand");
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Entré·e")).toBeInTheDocument();
  });
});

describe("CheckinScreen — offline", () => {
  it("keeps a scan made without network and sends it on sync", async () => {
    localStorage.clear();
    actions.checkinAction.mockReset();
    actions.checkinAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<CheckinScreen eventId="e1" initialStats={{ confirmedCount: 10, checkedInCount: 3 }} />);

    await user.click(await screen.findByRole("button", { name: "simuler un scan" }));
    expect(await screen.findByText("Hors ligne")).toBeInTheDocument();
    expect(screen.getByText("1 scan en attente de réseau")).toBeInTheDocument();
    expect(localStorage.getItem("bde-checkin-queue:e1")).toContain("tok-1");

    actions.checkinAction.mockResolvedValueOnce({
      outcome: { tone: "success", title: "Jeanne", detail: "Bienvenue !" },
      stats: { confirmedCount: 10, checkedInCount: 4 },
    });
    await user.click(screen.getByRole("button", { name: "Synchroniser" }));
    expect(
      await screen.findByText("Synchronisé : 1 entrée(s), 0 déjà entrée(s), 0 refusée(s)."),
    ).toBeInTheDocument();
    expect(actions.checkinAction).toHaveBeenLastCalledWith("e1", { qrToken: "tok-1" });
    expect(screen.queryByText(/en attente de réseau/)).toBeNull();
    expect(localStorage.getItem("bde-checkin-queue:e1")).toBeNull();
  });
});
