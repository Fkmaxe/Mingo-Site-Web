import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MemberCombobox, type MemberOption } from "./member-combobox";

const members: MemberOption[] = [
  { id: "u1", name: "Éloïse Martin", avatarUrl: null, detail: "Trésorier" },
  { id: "u2", name: "Hugo Bernard", avatarUrl: "/avatars/hugo.jpg", detail: "Pôle Sport" },
  { id: "u3", name: "Inès Petit", avatarUrl: null, detail: "Pôle Communication" },
];

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <MemberCombobox
        id="initiator"
        label="Initiateur"
        members={members}
        value={value}
        onChange={setValue}
      />
      <output>{value ?? "aucun"}</output>
    </>
  );
}

describe("MemberCombobox", () => {
  it("suggests members as one types, ignoring accents, and picks one with a click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Initiateur" });
    await user.type(input, "eloise");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Éloïse Martin");
    expect(options[0]).toHaveTextContent("Trésorier");
    await user.click(options[0] as HTMLElement);
    expect(screen.getByRole("status")).toHaveTextContent("u1");
    expect(screen.getByText("Éloïse Martin")).toBeInTheDocument();
  });

  it("searches the pole too and works with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Initiateur" });
    await user.type(input, "pôle");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("u3");
  });

  it("shows the chosen member as a chip that can be cleared", async () => {
    const user = userEvent.setup();
    render(<Harness initial="u2" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retirer Hugo Bernard" }));
    expect(screen.getByRole("status")).toHaveTextContent("aucun");
    expect(screen.getByRole("combobox", { name: "Initiateur" })).toBeInTheDocument();
  });

  it("closes the suggestions with Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("combobox", { name: "Initiateur" }), "i");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
