import { parseEnv } from "@bde/shared";
import { z } from "zod";

function isLocal(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** "Name <address>" or a bare address: what an SMTP server accepts as sender. */
function isMailbox(value: string): boolean {
  const address = value.match(/<([^<>]+)>\s*$/)?.[1] ?? value.trim();
  return z.email().safeParse(address).success;
}

/** `KEY=` in .env (empty) means "not set". */
const optionalText = (schema: z.ZodString) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

/** Id of a Discord channel or role (right click → « Copier l'identifiant »). */
const Snowflake = z.string().regex(/^\d{17,20}$/, "identifiant Discord : 17 à 20 chiffres");

/** `DISCORD_TASKS_CHANNEL_SPORT` → task channel of the pole whose slug is `sport`. */
const POLE_TASKS_CHANNEL = /^DISCORD_TASKS_CHANNEL_([A-Z0-9_]+)$/;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.url(),
    DATABASE_URL_TEST: z.url().optional(),
    // An origin is compared exactly (CORS, passkeys): "https://x.fr/" becomes "https://x.fr".
    WEB_ORIGIN: z.url().transform((url) => new URL(url).origin),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit faire au moins 32 caractères"),
    BETTER_AUTH_URL: z.url(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z
      .string()
      .refine(
        isMailbox,
        "doit être une adresse mail, ex. « BDE Mingo <no-reply@bde-mingo.fr> » ou « no-reply@bde-mingo.fr »",
      ),
    /** Directory of uploaded files (inventory photos). In Docker: a volume. */
    UPLOAD_DIR: z.string().min(1).default("uploads"),
    /** Name announced to the SMTP server (EHLO). Default: the domain of MAIL_FROM. */
    SMTP_EHLO_NAME: optionalText(z.string()),
    /** Web Push (VAPID). All three or none: without them, notifications are off. */
    VAPID_PUBLIC_KEY: optionalText(z.string()),
    VAPID_PRIVATE_KEY: optionalText(z.string()),
    VAPID_SUBJECT: optionalText(
      z.string().regex(/^(mailto:|https:\/\/)/, "doit commencer par mailto: ou https://"),
    ),
    /** Discord bot: without its token, nothing is posted. Every channel is optional. */
    DISCORD_BOT_TOKEN: optionalText(z.string().min(20, "jeton de bot Discord invalide")),
    DISCORD_EVENTS_CHANNEL_ID: optionalText(Snowflake),
    /** Role pinged with each published event (e.g. @Membres). */
    DISCORD_EVENTS_ROLE_ID: optionalText(Snowflake),
    DISCORD_APPLICATIONS_CHANNEL_ID: optionalText(Snowflake),
    DISCORD_BOARD_TASKS_CHANNEL_ID: optionalText(Snowflake),
  })
  .superRefine((env, ctx) => {
    const vapid = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT];
    if (vapid.some(Boolean) && !vapid.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["VAPID_PUBLIC_KEY"],
        message: "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT vont ensemble",
      });
    }
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

export type Env = z.infer<typeof EnvSchema> & {
  /** Task channel of each pole, by pole slug (`DISCORD_TASKS_CHANNEL_<SLUG>`). */
  DISCORD_TASKS_CHANNELS: Record<string, string>;
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const env = parseEnv(EnvSchema, source);
  const poleKeys = Object.fromEntries(
    Object.entries(source).filter(([key, value]) => POLE_TASKS_CHANNEL.test(key) && value),
  );
  const channels = parseEnv(z.record(z.string(), Snowflake), poleKeys);
  return {
    ...env,
    DISCORD_TASKS_CHANNELS: Object.fromEntries(
      Object.entries(channels).map(([key, id]) => [
        (POLE_TASKS_CHANNEL.exec(key)?.[1] ?? "").toLowerCase().replaceAll("_", "-"),
        id,
      ]),
    ),
  };
}
