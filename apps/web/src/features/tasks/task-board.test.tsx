import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskBoard } from "./task-board";
import type { Task } from "./types";

const actions = vi.hoisted(() => ({ moveTaskAction: vi.fn(), deleteTaskAction: vi.fn() }));
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const task = (
  id: string,
  status: Task["status"],
  rights: Partial<Pick<Task, "canEdit" | "canMove">> = {},
): Task => ({
  id,
  title: `Tâche ${id}`,
  description: "",
  status,
  dueOn: null,
  pole: { id: "p", name: "Sport" },
  assignee: null,
  canEdit: false,
  canMove: true,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...rights,
});

describe("TaskBoard", () => {
  it("shows one status at a time on phones and moves a task forward", async () => {
    actions.moveTaskAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TaskBoard
        tasks={[task("a", "todo"), task("b", "doing"), task("c", "done", { canMove: false })]}
      />,
    );

    expect(screen.getByRole("tab", { name: "À faire (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const todo = screen.getByText("Tâche a").closest("li");
    if (!todo) throw new Error("carte manquante");
    await user.click(within(todo).getByRole("button", { name: "En cours" }));
    expect(actions.moveTaskAction).toHaveBeenCalledWith("a", "doing");

    await user.click(screen.getByRole("tab", { name: "Fait (1)" }));
    const done = screen.getByText("Tâche c").closest("li");
    expect(within(done as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("offers deletion only to organisers", () => {
    render(<TaskBoard tasks={[task("a", "todo", { canEdit: true }), task("b", "todo")]} />);
    expect(screen.getAllByRole("button", { name: /Supprimer/ })).toHaveLength(1);
  });
});
