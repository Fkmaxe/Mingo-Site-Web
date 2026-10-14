import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassForm } from "./class-form";

const updateClass = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ updateClassAction: updateClass }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const levels = [
  { id: "l1", name: "1A", code: "1", alternanceOnly: false, trackIds: ["tc"] },
  { id: "l4", name: "4A", code: "4", alternanceOnly: true, trackIds: ["al"] },
];
const tracks = [
  { id: "tc", name: "Tronc commun", code: null },
  { id: "al", name: "Architecture logicielle", code: "AL" },
];

function renderForm() {
  render(
    <ClassForm
      levels={levels}
      tracks={tracks}
      levelId={null}
      trackId={null}
      rhythm={null}
      classNumber={null}
      januaryIntake={false}
    />,
  );
  return userEvent.setup();
}

describe("ClassForm", () => {
  beforeEach(() => updateClass.mockReset().mockResolvedValue({ ok: true }));

  it("previews the ESGI code and sends the number and the January intake", async () => {
    const user = renderForm();
    await user.selectOptions(screen.getByLabelText("Année"), "l4");
    await user.selectOptions(screen.getByLabelText("Filière"), "al");
    await user.selectOptions(screen.getByLabelText("Numéro de classe"), "1");
    expect(screen.getByText("4AL1")).toBeInTheDocument();
    expect(screen.getByLabelText("Rentrée de janvier")).not.toBeChecked();
    await user.click(screen.getByLabelText("Rentrée de janvier"));
    await user.click(screen.getByRole("button", { name: "Enregistrer ma classe" }));

    expect(updateClass).toHaveBeenCalledWith({
      levelId: "l4",
      trackId: "al",
      rhythm: "alternance",
      classNumber: 1,
      januaryIntake: true,
    });
  });

  it("uses the rhythm letter for a programme without code", async () => {
    const user = renderForm();
    await user.selectOptions(screen.getByLabelText("Année"), "l1");
    await user.selectOptions(screen.getByLabelText("Filière"), "tc");
    await user.selectOptions(screen.getByLabelText("Numéro de classe"), "3");
    await user.click(screen.getByLabelText("Alternance"));
    expect(screen.getByText("1A3")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Initial"));
    expect(screen.getByText("1I3")).toBeInTheDocument();
  });

  it("asks for the class number before saving a year", async () => {
    const user = renderForm();
    await user.selectOptions(screen.getByLabelText("Année"), "l1");
    await user.click(screen.getByRole("button", { name: "Enregistrer ma classe" }));
    expect(screen.getByText("Choisis ton numéro de classe")).toBeInTheDocument();
    expect(updateClass).not.toHaveBeenCalled();
  });
});
