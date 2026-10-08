import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./transaction-form";

const createTransactionAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ createTransactionAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const EVENT_ID = "0b7f1f0e-6a59-4c8a-9a5d-3a1d6c3c2f10";

describe("TransactionForm", () => {
  it("records an expense as negative cents", async () => {
    createTransactionAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TransactionForm events={[{ id: EVENT_ID, title: "Gala" }]} today="2026-10-08" />);
    await user.type(screen.getByLabelText("Montant (€)"), "45,50");
    await user.type(screen.getByLabelText("Libellé"), "Boissons");
    await user.selectOptions(screen.getByLabelText("Événement (facultatif)"), EVENT_ID);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() =>
      expect(createTransactionAction).toHaveBeenCalledWith({
        label: "Boissons",
        amountCents: -4550,
        occurredOn: "2026-10-08",
        eventId: EVENT_ID,
        receiptUrl: null,
      }),
    );
  });

  it("refuses an amount with 3 decimals", async () => {
    const user = userEvent.setup();
    render(<TransactionForm events={[]} today="2026-10-08" />);
    await user.type(screen.getByLabelText("Montant (€)"), "1,234");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(screen.getByText("Indique un montant positif, 2 décimales au plus")).toBeInTheDocument();
  });
});
