import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApplyForm } from "./apply-form";
import type { ApplicationForm } from "./types";

const actions = vi.hoisted(() => ({
  applyAction: vi.fn(),
  handInFileAction: vi.fn(),
  handInLinkAction: vi.fn(),
}));
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const SPORT = "00000000-0000-4000-8000-000000000001";
const COM = "00000000-0000-4000-8000-000000000002";

const form: ApplicationForm = {
  isOpen: true,
  closesAt: null,
  acceptingNow: true,
  intro: "",
  maxWishes: 2,
  allPolesRecruiting: true,
  recruitingPoles: [
    { id: SPORT, name: "Sport" },
    { id: COM, name: "Communication" },
  ],
  fields: [{ key: "motivation", label: "Ta motivation", type: "longtext", required: true }],
  documents: [
    { key: "cv", label: "CV", required: true, pdfOnly: true, allowLink: false },
    { key: "book", label: "Portfolio", required: false, pdfOnly: false, allowLink: true },
  ],
};

describe("ApplyForm", () => {
  it("asks for a first wish and the required documents before sending", async () => {
    const user = userEvent.setup();
    render(<ApplyForm form={form} />);
    await user.type(screen.getByLabelText("Ta motivation *"), "J'aime organiser.");
    await user.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    expect(screen.getByText("Choisis un pôle")).toBeInTheDocument();
    expect(screen.getByText("Ce document est obligatoire")).toBeInTheDocument();
    expect(actions.applyAction).not.toHaveBeenCalled();
  });

  it("sends the ranked wishes and answers, then the documents", async () => {
    actions.applyAction.mockResolvedValue({ ok: true });
    actions.handInFileAction.mockResolvedValue({ ok: true });
    actions.handInLinkAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ApplyForm form={form} />);
    await user.selectOptions(screen.getByLabelText("Premier choix *"), COM);
    await user.selectOptions(screen.getByLabelText("Deuxième choix (facultatif)"), SPORT);
    await user.type(screen.getByLabelText("Ta motivation *"), "J'aime organiser.");
    const cv = new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("CV : fichier"), cv);
    await user.click(screen.getByLabelText("Un lien"));
    await user.type(screen.getByLabelText("Portfolio : lien"), "https://drive.google.com/x");
    await user.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));

    expect(actions.applyAction).toHaveBeenCalledWith({
      wishedPoleIds: [COM, SPORT],
      answers: { motivation: "J'aime organiser." },
    });
    expect(actions.handInFileAction).toHaveBeenCalledWith("cv", expect.any(FormData));
    expect(actions.handInLinkAction).toHaveBeenCalledWith("book", "https://drive.google.com/x");
  });
});
