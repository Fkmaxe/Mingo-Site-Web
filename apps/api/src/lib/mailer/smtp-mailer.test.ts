import { describe, expect, it } from "vitest";
import { ehloName, maskAddress } from "./smtp-mailer";

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

describe("maskAddress", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskAddress("m.grados@myskolae.fr")).toBe("m***@myskolae.fr");
  });
});

describe("messageOf", () => {
  it("attaches the logo inline only when the HTML uses it", async () => {
    const { buildMail, LOGO_CID } = await import("./layout");
    const { messageOf } = await import("./smtp-mailer");
    const branded = buildMail({
      to: "a@myskolae.fr",
      subject: "s",
      title: "t",
      paragraphs: [],
      action: { label: "l", url: "https://x.fr" },
    });
    expect(messageOf("BDE <a@bde-mingo.fr>", branded).attachments).toMatchObject([
      { cid: LOGO_CID, contentType: "image/png" },
    ]);
    const plain = { to: "a@myskolae.fr", subject: "s", text: "t", html: "<p>t</p>" };
    expect(messageOf("BDE <a@bde-mingo.fr>", plain).attachments).toEqual([]);
  });
});
