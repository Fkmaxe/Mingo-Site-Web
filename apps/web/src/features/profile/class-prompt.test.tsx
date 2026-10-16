import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassPrompt } from "./class-prompt";

const state = vi.hoisted(() => ({ pathname: "/home", sessionId: "session-1" as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: state.sessionId ? { session: { id: state.sessionId } } : null }),
  },
}));
vi.mock("./actions", () => ({ updateClassAction: vi.fn() }));

beforeAll(() => {
  // jsdom has <dialog> but not its modal API.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  localStorage.clear();
  state.pathname = "/home";
  state.sessionId = "session-1";
});

const props = {
  levels: [{ id: "l1", name: "1re année", code: "1", alternanceOnly: false, trackIds: [] }],
  tracks: [{ id: "t1", name: "Initial", code: "I" }],
  levelId: null,
  trackId: null,
  rhythm: null,
  classNumber: null,
  januaryIntake: false,
};

describe("ClassPrompt", () => {
  it("asks for the class, with the class form inside", () => {
    render(<ClassPrompt {...props} />);
    expect(screen.getByRole("dialog", { name: "C'est quoi ta classe ?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Année")).toBeInTheDocument();
  });

  it("is put off until the next sign-in", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ClassPrompt {...props} />);
    await user.click(screen.getAllByRole("button", { name: "Plus tard" })[0] as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    // Same session, another page: still put off.
    render(<ClassPrompt {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("comes back with a new session", () => {
    localStorage.setItem("class-prompt-dismissed-session", "session-1");
    state.sessionId = "session-2";
    render(<ClassPrompt {...props} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stays away from the pages that already ask for the class, and without a session", () => {
    state.pathname = "/profile";
    const { unmount } = render(<ClassPrompt {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    state.pathname = "/home";
    state.sessionId = null;
    render(<ClassPrompt {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
