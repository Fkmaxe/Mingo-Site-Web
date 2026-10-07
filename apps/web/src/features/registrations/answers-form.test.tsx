import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnswersForm } from "./answers-form";

const fields = [
  { key: "taille", label: "Taille", type: "select" as const, required: true, options: ["S", "M"] },
  { key: "age", label: "Âge", type: "number" as const, required: false },
  { key: "ok", label: "J'accepte", type: "checkbox" as const, required: true },
];

describe("AnswersForm", () => {
  it("shows French errors before calling the API, then submits typed answers", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AnswersForm
        fields={fields}
        submitLabel="S'inscrire"
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Cette case doit être cochée")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Taille *"), "M");
    await user.type(screen.getByLabelText("Âge"), "20");
    await user.click(screen.getByLabelText("J'accepte *"));
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(onSubmit).toHaveBeenCalledWith({ taille: "M", age: 20, ok: true });
  });
});
