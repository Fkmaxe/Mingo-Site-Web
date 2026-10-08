import { describe, expect, it } from "vitest";
import { ehloName } from "./smtp-mailer";

describe("ehloName", () => {
  it("uses the domain of MAIL_FROM, with or without a display name", () => {
    expect(ehloName({ MAIL_FROM: "BDE Mingo <no-reply@bde-mingo.fr>" })).toBe("bde-mingo.fr");
    expect(ehloName({ MAIL_FROM: "no-reply@Mail.BDE-Mingo.fr" })).toBe("mail.bde-mingo.fr");
  });

  it("prefers SMTP_EHLO_NAME, and gives up on an address without a domain", () => {
    expect(ehloName({ SMTP_EHLO_NAME: "mingo.grados.fr", MAIL_FROM: "x@bde-mingo.fr" })).toBe(
      "mingo.grados.fr",
    );
    expect(ehloName({ MAIL_FROM: "BDE Mingo" })).toBeUndefined();
  });
});
