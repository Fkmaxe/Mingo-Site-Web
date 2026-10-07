import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttendanceList } from "./attendance-list";
import type { Meeting } from "./types";

const setAttendanceAction = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ setAttendanceAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const meeting: Meeting = {
  id: "m1",
  title: "Réunion sport",
  startsAt: "2026-10-12T17:00:00.000Z",
  location: "",
  agenda: "",
  minutes: "",
  pole: { id: "p", name: "Sport" },
  canManage: true,
  present: false,
  attendees: [
    { user: { id: "u1", name: "Jeanne", promo: "3A" }, present: true },
    { user: { id: "u2", name: "Paul", promo: null }, present: false },
  ],
};

describe("AttendanceList", () => {
  it("counts the present members and marks someone present", async () => {
    setAttendanceAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AttendanceList meeting={meeting} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Présents (1/2)");
    await user.click(screen.getByRole("checkbox", { name: /Paul/ }));
    expect(setAttendanceAction).toHaveBeenCalledWith("m1", "u2", true);
  });
});
