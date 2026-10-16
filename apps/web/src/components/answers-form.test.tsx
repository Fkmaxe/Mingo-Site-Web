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

    await user.click(screen.getByRole("radio", { name: "M" }));
    await user.type(screen.getByLabelText("Âge"), "20");
    await user.click(screen.getByLabelText("J'accepte *"));
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(onSubmit).toHaveBeenCalledWith({ taille: "M", age: 20, ok: true });
  });

  it("shows the explanation, asks for the 'Autre' text and sends several choices", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <AnswersForm
        fields={[
          {
            key: "contact",
            label: "Ton moyen de contact",
            description: "Au moins un :\n- Discord : @pseudo",
            type: "longtext",
            required: true,
          },
          {
            key: "source",
            label: "Comment as-tu connu l'événement ?",
            type: "select",
            required: true,
            options: ["Discord", "Flyers"],
            allowOther: true,
          },
          {
            key: "jeux",
            label: "Jeux",
            type: "multiselect",
            required: false,
            options: ["Tekken", "Smash"],
          },
        ]}
        submitLabel="S'inscrire"
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    const contact = screen.getByLabelText("Ton moyen de contact *");
    expect(contact).toHaveAccessibleDescription(/Au moins un :\s+- Discord : @pseudo/);
    await user.type(contact, "Discord : @mingo");
    await user.click(screen.getByRole("radio", { name: "Autre" }));
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(screen.getByText("Précise ta réponse")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/autre réponse/), "Un ami");
    await user.click(screen.getByRole("checkbox", { name: "Tekken" }));
    await user.click(screen.getByRole("checkbox", { name: "Smash" }));
    await user.click(screen.getByRole("checkbox", { name: "Tekken" }));
    await user.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(onSubmit).toHaveBeenCalledWith({
      contact: "Discord : @mingo",
      source: "Un ami",
      jeux: ["Smash"],
    });
  });
});
