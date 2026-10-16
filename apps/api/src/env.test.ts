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

  it("keeps the web origin without a trailing slash", () => {
    expect(loadEnv({ ...validEnv, WEB_ORIGIN: "https://bde-mingo.fr/" }).WEB_ORIGIN).toBe(
      "https://bde-mingo.fr",
    );
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

  it("reads the Discord channels, one per pole by its slug, and checks the ids", () => {
    const env = loadEnv({
      ...validEnv,
      DISCORD_BOT_TOKEN: "x".repeat(70),
      DISCORD_EVENTS_CHANNEL_ID: "123456789012345678",
      DISCORD_TASKS_CHANNEL_SPORT: "223456789012345678",
      DISCORD_TASKS_CHANNEL_E_SPORT: "323456789012345678",
      DISCORD_TASKS_CHANNEL_COM: "",
    });
    expect(env.DISCORD_EVENTS_CHANNEL_ID).toBe("123456789012345678");
    expect(env.DISCORD_TASKS_CHANNELS).toEqual({
      sport: "223456789012345678",
      "e-sport": "323456789012345678",
    });
    expect(() => loadEnv({ ...validEnv, DISCORD_TASKS_CHANNEL_SPORT: "#sport" })).toThrow(
      /DISCORD_TASKS_CHANNEL_SPORT/,
    );
    expect(() => loadEnv({ ...validEnv, DISCORD_APPLICATIONS_CHANNEL_ID: "12" })).toThrow(
      /DISCORD_APPLICATIONS_CHANNEL_ID/,
    );
  });
});
