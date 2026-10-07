import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("translates known Better Auth codes", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "Email ou mot de passe incorrect.",
    );
    expect(authErrorMessage({ code: "DOMAIN_NOT_ALLOWED", status: 403 })).toContain("@myskolae.fr");
  });

  it("explains rate limiting", () => {
    expect(authErrorMessage({ status: 429 })).toContain("Trop de tentatives");
  });

  it("falls back to a generic French message", () => {
    expect(authErrorMessage({ code: "SOMETHING_NEW", status: 500 })).toContain("Réessaie");
  });
});
