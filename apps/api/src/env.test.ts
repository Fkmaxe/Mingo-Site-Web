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
    expect(env.ALLOWED_EMAIL_DOMAIN).toBe("myskolae.fr");
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
});
