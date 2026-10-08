import { describe, expect, it } from "vitest";
import { diagnose } from "./mail-test";

describe("diagnose", () => {
  it("explains the usual SMTP failures", () => {
    expect(diagnose({ message: "wrong version number" }, true, 587)).toMatch(/SMTP_SECURE=false/);
    expect(diagnose({ message: "x", code: "ETIMEDOUT" }, false, 587)).toMatch(/bloqué/);
    expect(diagnose({ message: "x", code: "EAUTH", responseCode: 535 }, false, 587)).toMatch(
      /Identifiants refusés/,
    );
    expect(diagnose({ message: "x", responseCode: 421 }, false, 587)).toMatch(/421/);
    expect(diagnose({ message: "x", responseCode: 553 }, false, 587)).toMatch(/MAIL_FROM/);
    expect(
      diagnose(
        { message: "Mail command failed: 501 5.1.7 Invalid address", responseCode: 501 },
        false,
        587,
      ),
    ).toMatch(/MAIL_FROM/);
    expect(diagnose("boom", false, 587)).toBe("Erreur inconnue.");
  });
});
