import { describe, expect, it } from "vitest";
import { buildMail, LOGO_CID } from "./layout";

const mail = () =>
  buildMail({
    to: "a@myskolae.fr",
    subject: "Confirme ton adresse",
    title: "Bienvenue <Camille>",
    paragraphs: ["Salut & bienvenue."],
    action: { label: "Confirmer", url: "https://app.bde-mingo.fr/v?t=1&x=2" },
  });

describe("buildMail", () => {
  it("shows the BDE logo (inline image) and escapes the content", () => {
    const { html } = mail();
    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    expect(html).toContain('alt="BDE Mingo"');
    expect(html).toContain("Bienvenue &lt;Camille&gt;");
    expect(html).toContain("Salut &amp; bienvenue.");
    expect(html).toContain('href="https://app.bde-mingo.fr/v?t=1&amp;x=2"');
  });

  it("keeps a plain-text version with the link and no HTML", () => {
    const { text } = mail();
    expect(text).toContain("Confirmer : https://app.bde-mingo.fr/v?t=1&x=2");
    expect(text).not.toContain("<");
  });
});

describe("buildMail with a code", () => {
  it("shows the code big, without a button, in both versions", () => {
    const mail = buildMail({
      to: "a@myskolae.fr",
      subject: "123456",
      title: "Ton code",
      code: "123456",
      paragraphs: ["Saisis-le sur le site."],
    });
    expect(mail.html).toContain(">123456</p>");
    expect(mail.html).not.toContain("<a href");
    expect(mail.text.startsWith("Code : 123456")).toBe(true);
  });
});
