import { describe, expect, it } from "vitest";
import { fromApiError } from "./action-result";

describe("fromApiError", () => {
  it("maps Zod issues to the first message per field", () => {
    expect(
      fromApiError({
        error: {
          code: "VALIDATION_ERROR",
          message: "Certaines données envoyées sont invalides.",
          details: {
            issues: [
              { path: ["title"], message: "Trop court" },
              { path: ["title"], message: "Autre" },
              { path: ["endsAt"], message: "La fin doit être après le début" },
            ],
          },
        },
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Certaines données envoyées sont invalides.",
      fieldErrors: { title: "Trop court", endsAt: "La fin doit être après le début" },
    });
  });

  it("keeps business errors without details", () => {
    expect(fromApiError({ error: { code: "FORBIDDEN", message: "Non." } })).toMatchObject({
      code: "FORBIDDEN",
      fieldErrors: {},
    });
  });
});
