import { describe, expect, it } from "vitest";
import { isAllowedEmail, SignUpInput } from "./auth";

describe("isAllowedEmail", () => {
  it.each([
    ["jeanne.durand@myskolae.fr", true],
    ["Jeanne.Durand@MYSKOLAE.FR", true],
    ["  jeanne@myskolae.fr ", true],
    ["jeanne@gmail.com", false],
    ["jeanne@myskolae.fr.evil.com", false],
    ["jeanne@notmyskolae.fr", false],
    ["myskolae.fr", false],
  ])("%s -> %s", (email, expected) => {
    expect(isAllowedEmail(email)).toBe(expected);
  });
});

describe("SignUpInput", () => {
  const valid = {
    name: "Jeanne",
    email: "jeanne@myskolae.fr",
    password: "correct-horse-battery",
    passwordConfirmation: "correct-horse-battery",
  };

  it("accepts a valid sign-up", () => {
    expect(SignUpInput.safeParse(valid).success).toBe(true);
  });

  it("rejects another domain with a French message", () => {
    const result = SignUpInput.safeParse({ ...valid, email: "jeanne@gmail.com" });
    expect(result.error?.issues[0]?.message).toBe("Utilise ton adresse @myskolae.fr");
  });

  it("rejects a short password", () => {
    const result = SignUpInput.safeParse({
      ...valid,
      password: "court",
      passwordConfirmation: "court",
    });
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("rejects mismatching passwords", () => {
    const result = SignUpInput.safeParse({ ...valid, passwordConfirmation: "autre-chose-encore" });
    expect(result.error?.issues[0]?.path).toEqual(["passwordConfirmation"]);
  });
});
