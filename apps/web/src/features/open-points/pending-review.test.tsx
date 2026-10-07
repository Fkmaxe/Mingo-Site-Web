import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PendingReview } from "./pending-review";
import type { LedgerEntry } from "./types";

const decideAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ decideAction }));

const entry = (id: string, name: string, event: string): LedgerEntry => ({
  id,
  delta: 2,
  reason: `Participation : ${event}`,
  source: "auto",
  status: "pending",
  createdAt: "2026-10-01T10:00:00.000Z",
  decidedAt: null,
  event: { id: `e-${event}`, slug: event, title: event },
  user: { id: `u-${id}`, name, email: `${id}@myskolae.fr`, promo: null },
});

describe("PendingReview", () => {
  it("groups by event, selects everything by default and validates the selection", async () => {
    decideAction.mockResolvedValue({ ok: true, updated: 1, skipped: 0 });
    const user = userEvent.setup();
    render(
      <PendingReview
        entries={[
          entry("a", "Jeanne", "Gala"),
          entry("b", "Paul", "Gala"),
          entry("c", "Inès", "Foot"),
        ]}
      />,
    );
    expect(screen.getByText("Gala (2)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider (3)" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: /Gala/ }));
    await user.click(screen.getByRole("button", { name: "Valider (1)" }));

    expect(decideAction).toHaveBeenCalledWith("validate", ["c"]);
    expect(await screen.findByRole("status")).toHaveTextContent("1 mouvement(s) validé(s).");
    expect(screen.getByRole("button", { name: "Valider (0)" })).toBeDisabled();
  });
});
