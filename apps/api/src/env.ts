import { parseEnv } from "@bde/shared";
import { z } from "zod";

function isLocal(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.url(),
    DATABASE_URL_TEST: z.url().optional(),
    WEB_ORIGIN: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit faire au moins 32 caractères"),
    BETTER_AUTH_URL: z.url(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    // Development values must never reach a real deployment: it fails at startup instead.
    // The full stack run locally (docker compose --profile full, on localhost) stays allowed.
    if (env.NODE_ENV !== "production" || isLocal(env.WEB_ORIGIN)) return;
    if (env.BETTER_AUTH_SECRET.includes("change-me")) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "valeur d'exemple : en générer une avec `openssl rand -base64 32`",
      });
    }
    for (const key of ["WEB_ORIGIN", "BETTER_AUTH_URL"] as const) {
      if (!env[key].startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: [key], message: "doit être en https en production" });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return parseEnv(EnvSchema, source);
}
