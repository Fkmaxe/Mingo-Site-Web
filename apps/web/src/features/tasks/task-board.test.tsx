import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskBoard } from "./task-board";
import type { Task } from "./types";

const actions = vi.hoisted(() => ({
  moveTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
  createTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
}));
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const task = (
  id: string,
  status: Task["status"],
  rights: Partial<Pick<Task, "canEdit" | "canContribute" | "scope" | "pole" | "dueOn">> = {},
): Task => ({
  id,
  title: `Tâche ${id}`,
  description: "",
  status,
  priority: "normal",
  dueOn: null,
  scope: "pole",
  pole: { id: "p", name: "Sport" },
  assignees: [],
  checklist: { done: 0, total: 0 },
  attachmentCount: 0,
  commentCount: 0,
  canEdit: false,
  canContribute: true,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...rights,
});

describe("TaskBoard", () => {
  it("shows one status at a time on phones and moves a task forward", async () => {
    actions.moveTaskAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TaskBoard
        tasks={[task("a", "todo"), task("b", "doing"), task("c", "done", { canContribute: false })]}
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

  it("offers edition and deletion only to organisers", () => {
    render(<TaskBoard tasks={[task("a", "todo", { canEdit: true }), task("b", "todo")]} />);
    expect(screen.getAllByRole("button", { name: /Supprimer/ })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Modifier/ })).toHaveLength(1);
  });

  it("links each card to its page and shows its counts", () => {
    render(
      <TaskBoard
        tasks={[
          {
            ...task("a", "todo", { canEdit: true }),
            priority: "high",
            checklist: { done: 1, total: 3 },
            attachmentCount: 2,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Tâche a" })).toHaveAttribute("href", "/tasks/a");
    expect(screen.getByText("Priorité haute")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("labels each card with its board in « Mes tâches », without an assignee for a personal one", () => {
    render(
      <TaskBoard
        showOrigin
        tasks={[
          task("a", "todo"),
          task("b", "todo", { scope: "board", pole: null }),
          task("c", "todo", { scope: "personal", pole: null, canEdit: true }),
        ]}
      />,
    );
    const card = (id: string) => screen.getByText(`Tâche ${id}`).closest("li") as HTMLElement;
    expect(within(card("a")).getByText("Pôle Sport")).toBeInTheDocument();
    expect(within(card("b")).getByText("Bureau")).toBeInTheDocument();
    expect(within(card("b")).getByText("Non assignée")).toBeInTheDocument();
    expect(within(card("c")).getByText("Perso")).toBeInTheDocument();
    expect(within(card("c")).queryByText("Non assignée")).toBeNull();
  });

  it("does not label the cards of a single board", () => {
    render(<TaskBoard tasks={[task("a", "todo")]} />);
    expect(screen.queryByText("Pôle Sport")).toBeNull();
  });
});
