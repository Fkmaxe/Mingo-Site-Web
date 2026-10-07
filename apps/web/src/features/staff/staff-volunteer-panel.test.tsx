import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StaffVolunteerPanel } from "./staff-volunteer-panel";
import type { StaffSlot } from "./types";

const volunteerAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ volunteerAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const slot = (id: string, mine: StaffSlot["mine"]): StaffSlot => ({
  id,
  label: `Créneau ${id}`,
  startsAt: "2026-12-12T18:00:00.000Z",
  endsAt: "2026-12-12T20:00:00.000Z",
  capacity: 2,
  validatedCount: 1,
  mine,
  assignments: [],
});

describe("StaffVolunteerPanel", () => {
  it("offers to volunteer, shows the status and lets the member withdraw", async () => {
    volunteerAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <StaffVolunteerPanel
        slots={[
          slot("a", null),
          slot("b", { id: "x", status: "proposed" }),
          slot("c", { id: "y", status: "declined" }),
        ]}
      />,
    );
    expect(screen.getAllByText(/sam\. 12 déc\. · 19:00 – 21:00 · 1\/2/i)).toHaveLength(3);
    expect(screen.getByText("Proposé·e, en attente du responsable")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Me proposer" }));
    expect(volunteerAction).toHaveBeenCalledWith("a", "volunteer");
    await user.click(screen.getByRole("button", { name: "Me retirer" }));
    expect(volunteerAction).toHaveBeenCalledWith("b", "withdraw");
  });

  it("renders nothing without slots", () => {
    const { container } = render(<StaffVolunteerPanel slots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
