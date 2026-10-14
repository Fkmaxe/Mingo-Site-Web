import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SchoolEmailField } from "./school-email-field";

function Harness({ initial = "" }: { initial?: string }) {
  const [email, setEmail] = useState(initial);
  return (
    <>
      <SchoolEmailField id="email" value={email} onChange={setEmail} />
      <output>{email}</output>
      <button type="button" onClick={() => setEmail("")}>
        Vider
      </button>
    </>
  );
}

describe("SchoolEmailField", () => {
  it("builds the school address from the identifier", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Adresse email de l'école"), "j.dupont");
    expect(screen.getByRole("status")).toHaveTextContent("j.dupont@myskolae.fr");
  });

  it("keeps only the identifier of a pasted address", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Adresse email de l'école");
    await user.click(input);
    await user.paste("j.dupont@myskolae.fr");
    expect(screen.getByRole("status")).toHaveTextContent("j.dupont@myskolae.fr");
    await user.tab();
    expect(input).toHaveValue("j.dupont");
  });

  it("shows the identifier of the current value and follows a reset", async () => {
    const user = userEvent.setup();
    render(<Harness initial="j.dupont@myskolae.fr" />);
    const input = screen.getByLabelText("Adresse email de l'école");
    expect(input).toHaveValue("j.dupont");
    await user.click(screen.getByRole("button", { name: "Vider" }));
    expect(input).toHaveValue("");
  });
});
