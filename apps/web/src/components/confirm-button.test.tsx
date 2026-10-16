import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmButton } from "./confirm-button";

describe("ConfirmButton", () => {
  it("asks first, does it on the second tap, and can be cancelled", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmButton
        aria-label="Supprimer « Affiches »"
        confirmLabel="Supprimer"
        onConfirm={onConfirm}
      >
        x
      </ConfirmButton>,
    );
    await user.click(screen.getByRole("button", { name: "Supprimer « Affiches »" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Supprimer « Affiches »" }));
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
