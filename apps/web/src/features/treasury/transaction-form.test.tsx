import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./transaction-form";
import { emptyTransactionForm } from "./transaction-form-values";

const actions = vi.hoisted(() => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  uploadAttachmentAction: vi.fn(),
}));
vi.mock("./actions", () => actions);
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const initiators = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Éloïse Martin",
    avatarUrl: null,
    detail: "Trésorier",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Hugo Bernard",
    avatarUrl: null,
    detail: "Pôle Sport",
  },
];
const events = [{ id: "00000000-0000-4000-8000-0000000000e1", title: "Gala" }];

function renderForm() {
  render(
    <TransactionForm
      initiators={initiators}
      events={events}
      defaultValues={emptyTransactionForm("2026-10-14", initiators[0]?.id ?? null)}
    />,
  );
  return userEvent.setup();
}

describe("TransactionForm", () => {
  beforeEach(() => {
    actions.createTransactionAction.mockReset().mockResolvedValue({ ok: true, id: "tx-1" });
    push.mockReset();
  });

  it("records a debit in cents with the initiator, then opens the entry", async () => {
    const user = renderForm();
    await user.type(screen.getByLabelText("Nom de la contrepartie"), "Metro");
    await user.type(screen.getByLabelText("Montant total (€)"), "45,50");
    await user.selectOptions(screen.getByLabelText("Événement (facultatif)"), "Gala");
    await user.type(screen.getByLabelText("Commentaire (facultatif)"), "Boissons");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(actions.createTransactionAction).toHaveBeenCalledWith({
      counterparty: "Metro",
      initiatorUserId: initiators[0]?.id,
      amountCents: 4550,
      occurredOn: "2026-10-14",
      kind: "debit",
      otherLabel: null,
      direction: null,
      eventId: events[0]?.id,
      comment: "Boissons",
    });
    expect(push).toHaveBeenCalledWith("/manage/treasury/tx-1");
  });

  it("asks for the name and the direction of an « other » entry", async () => {
    const user = renderForm();
    expect(screen.queryByLabelText("Précise le type")).toBeNull();
    await user.click(screen.getByLabelText("Autre"));
    await user.type(screen.getByLabelText("Nom de la contrepartie"), "BDE");
    await user.type(screen.getByLabelText("Montant total (€)"), "10");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Précise le type d'opération")).toBeInTheDocument();
    expect(screen.getByText("Indique si l'argent entre ou sort")).toBeInTheDocument();
    expect(actions.createTransactionAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Précise le type"), "Virement interne");
    await user.click(screen.getByLabelText("Entrée d'argent"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(actions.createTransactionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "other",
        otherLabel: "Virement interne",
        direction: "in",
        amountCents: 1000,
      }),
    );
  });

  it("refuses an amount that is not in euros, and requires an initiator", async () => {
    const user = renderForm();
    await user.type(screen.getByLabelText("Nom de la contrepartie"), "Metro");
    await user.type(screen.getByLabelText("Montant total (€)"), "douze");
    await user.click(screen.getByRole("button", { name: "Retirer Éloïse Martin" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Montant invalide : 12,50 par exemple")).toBeInTheDocument();
    expect(screen.getByText("Choisis l'initiateur")).toBeInTheDocument();
    expect(actions.createTransactionAction).not.toHaveBeenCalled();
  });

  it("locks the amount and the kind when correcting an entry", async () => {
    actions.updateTransactionAction.mockResolvedValue({ ok: true });
    render(
      <TransactionForm
        initiators={initiators}
        events={events}
        defaultValues={{
          ...emptyTransactionForm("2026-10-01", initiators[1]?.id ?? null),
          counterparty: "Metro",
          amount: "45,50",
        }}
        edit={{ transactionId: "tx-9", amountCents: -4550 }}
      />,
    );
    const user = userEvent.setup();
    expect(screen.queryByLabelText("Montant total (€)")).toBeNull();
    expect(screen.getByText(/-45,50/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Nom de la contrepartie"));
    await user.type(screen.getByLabelText("Nom de la contrepartie"), "Metro Paris");
    await user.click(screen.getByRole("button", { name: "Enregistrer les corrections" }));
    expect(actions.updateTransactionAction).toHaveBeenCalledWith("tx-9", {
      counterparty: "Metro Paris",
      occurredOn: "2026-10-01",
      eventId: null,
      comment: "",
    });
    expect(push).toHaveBeenCalledWith("/manage/treasury/tx-9");
  });
});
