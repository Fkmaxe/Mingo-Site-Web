import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskForm } from "./task-form";
import type { PoleMember, TaskDetail } from "./types";

const actions = vi.hoisted(() => ({ createTaskAction: vi.fn(), updateTaskAction: vi.fn() }));
vi.mock("./actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const member = (id: string, name: string): PoleMember => ({
  membershipId: `00000000-0000-4000-8000-00000000000${id === "a" ? 1 : 2}`,
  role: "member",
  user: { id, name, promo: null },
});

const task: TaskDetail = {
  id: "t",
  title: "Réserver le gymnase",
  description: "",
  status: "todo",
  priority: "normal",
  dueOn: "2026-11-01",
  scope: "pole",
  pole: { id: "p", name: "Sport" },
  assignees: [member("a", "Alex")],
  checklist: { done: 0, total: 0 },
  attachmentCount: 0,
  commentCount: 0,
  canEdit: true,
  canContribute: true,
  createdAt: "2026-10-01T10:00:00.000Z",
  checklistItems: [],
  comments: [],
  attachments: [],
  history: [],
};

describe("TaskForm", () => {
  it("edits the assignees, the priority, and removes the deadline with « Sans délai »", async () => {
    actions.updateTaskAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <TaskForm
        mode="edit"
        task={task}
        members={[member("a", "Alex"), member("b", "Bao")]}
        onDone={onDone}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Bao"));
    await user.selectOptions(screen.getByLabelText("Priorité"), "high");
    await user.click(screen.getByLabelText("Sans délai"));
    expect(screen.queryByLabelText("À faire avant le")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(actions.updateTaskAction).toHaveBeenCalledWith("t", {
      title: "Réserver le gymnase",
      description: "",
      priority: "high",
      dueOn: null,
      assigneeMembershipIds: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("asks for a date unless « Sans délai » is ticked", async () => {
    const user = userEvent.setup();
    render(
      <TaskForm
        mode="create"
        target={{ kind: "personal" }}
        members={[]}
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Titre"), "Réviser");
    await user.click(screen.getByRole("button", { name: "Créer" }));
    expect(screen.getByText("Choisis une date ou coche « Sans délai »")).toBeInTheDocument();
    expect(actions.createTaskAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Assignée à")).toBeNull();
  });
});
