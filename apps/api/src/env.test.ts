import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgres://bde:bde@localhost:5432/bde_mingo",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3001",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "BDE Mingo <no-reply@bde-mingo.fr>",
};

describe("loadEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3001);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.NODE_ENV).toBe("development");
  });

  it("parses SMTP_SECURE as a boolean", () => {
    expect(loadEnv({ ...validEnv, SMTP_SECURE: "true" }).SMTP_SECURE).toBe(true);
  });

  it("lists every invalid variable", () => {
    const { DATABASE_URL: _, ...withoutDb } = validEnv;
    expect(() => loadEnv({ ...withoutDb, BETTER_AUTH_SECRET: "short" })).toThrow(
      /DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/,
    );
  });

  it("refuses development values in production", () => {
    const prod = {
      ...validEnv,
      NODE_ENV: "production",
      WEB_ORIGIN: "http://bde-mingo.fr",
      BETTER_AUTH_URL: "http://bde-mingo.fr",
    };
    expect(() =>
      loadEnv({ ...prod, BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me" }),
    ).toThrow(/BETTER_AUTH_SECRET[\s\S]*WEB_ORIGIN[\s\S]*BETTER_AUTH_URL/);
    expect(
      loadEnv({
        ...prod,
        WEB_ORIGIN: "https://bde-mingo.fr",
        BETTER_AUTH_URL: "https://bde-mingo.fr",
      }).NODE_ENV,
    ).toBe("production");
  });

  it("keeps the local full stack (production build on localhost) working", () => {
    expect(
      loadEnv({
        ...validEnv,
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me",
      }).NODE_ENV,
    ).toBe("production");
  });

  it("treats empty push keys as not set, and wants all three together", () => {
    const off = loadEnv({ ...validEnv, VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "" });
    expect(off.VAPID_PUBLIC_KEY).toBeUndefined();
    expect(() => loadEnv({ ...validEnv, VAPID_PUBLIC_KEY: "abc" })).toThrow(/VAPID_PUBLIC_KEY/);
    expect(
      loadEnv({
        ...validEnv,
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
        VAPID_SUBJECT: "mailto:bureau@bde-mingo.fr",
      }).VAPID_SUBJECT,
    ).toBe("mailto:bureau@bde-mingo.fr");
  });

  it("wants a real sender address in MAIL_FROM", () => {
    expect(() => loadEnv({ ...validEnv, MAIL_FROM: "BDE Mingo <pro3.mail.ovh.net>" })).toThrow(
      /MAIL_FROM/,
    );
    expect(loadEnv({ ...validEnv, MAIL_FROM: "contact@fkcloud.fr" }).MAIL_FROM).toBe(
      "contact@fkcloud.fr",
    );
  });
});
