import {
  ALLOWED_EMAIL_DOMAIN,
  composeName,
  isAllowedEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PersonNameFields,
  splitName,
} from "@bde/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";
import type { Db } from "../../db/client";
import { account, session, user, verification } from "../../db/schema";
import type { Env } from "../../env";
import type { Mailer } from "../../lib/mailer";
import { resetPasswordEmail, verificationEmail } from "./emails";

export type AuthDeps = {
  env: Pick<Env, "NODE_ENV" | "WEB_ORIGIN" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL">;
  db: Db;
  mailer: Mailer;
};

export const AUTH_BASE_PATH = "/api/auth";

function domainNotAllowed() {
  return APIError.from("FORBIDDEN", {
    code: "DOMAIN_NOT_ALLOWED",
    message: `Seules les adresses @${ALLOWED_EMAIL_DOMAIN} peuvent créer un compte.`,
  });
}

function profileUpdateElsewhere() {
  return APIError.from("FORBIDDEN", {
    code: "PROFILE_UPDATE_NOT_ALLOWED",
    message: "Modifie ton profil depuis la page Profil.",
  });
}

function invalidName(error: z.ZodError) {
  return APIError.from("BAD_REQUEST", {
    code: "INVALID_NAME",
    message: error.issues[0]?.message ?? "Prénom ou nom invalide",
  });
}

const EmailBody = z.object({ email: z.string() });
const SignUpNames = z.object(PersonNameFields);

/** Shared by the app and the test helpers, so test sessions are valid for the app. */
export function authOptions({ env, db, mailer }: AuthDeps) {
  return {
    appName: "BDE Mingo",
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    advanced: {
      // Ids come from the database (gen_random_uuid()).
      database: { generateId: false as const },
      // Set by the reverse proxy in front of the web, passed on as is by the Next proxy. Only a
      // single value is trusted (Better Auth default without trustedProxies). Never expose
      // the API port: only the web, behind the reverse proxy, may reach it.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    user: {
      additionalFields: {
        // Accepted at sign-up only: /update-user is blocked below, PATCH /v1/me changes them.
        firstName: { type: "string" as const, required: true, input: true },
        lastName: { type: "string" as const, required: true, input: true },
        promo: { type: "string" as const, required: false, input: false },
        isAdmin: { type: "boolean" as const, required: false, defaultValue: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => {
        await mailer.send(resetPasswordEmail(user, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => {
        await mailer.send(verificationEmail(user, url));
      },
    },
    hooks: {
      // Checked before Better Auth's sign-up logic, which turns errors thrown during user
      // creation into a generic success response (anti-enumeration).
      before: createAuthMiddleware(async (ctx) => {
        // Profile changes go through PATCH /v1/me, which validates and writes the audit log.
        if (ctx.path === "/update-user") throw profileUpdateElsewhere();
        if (ctx.path !== "/sign-up/email") return;
        const body = EmailBody.safeParse(ctx.body);
        if (body.success && !isAllowedEmail(body.data.email)) throw domainNotAllowed();
        const names = SignUpNames.safeParse(ctx.body);
        if (!names.success) throw invalidName(names.error);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Safety net for any other user creation path (the SQL check is the last one).
          // Also keeps `name` equal to "First Last", whatever the client sent.
          before: async (data: {
            email: string;
            name: string;
            firstName?: string | null;
            lastName?: string | null;
          }) => {
            if (!isAllowedEmail(data.email)) throw domainNotAllowed();
            const split = splitName(data.name);
            const firstName = data.firstName?.trim() || split.firstName;
            const lastName = data.lastName?.trim() || split.lastName;
            return {
              data: { ...data, firstName, lastName, name: composeName(firstName, lastName) },
            };
          },
        },
      },
    },
    rateLimit: {
      enabled: env.NODE_ENV !== "test",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
  };
}

export function createAuth(deps: AuthDeps) {
  return betterAuth(authOptions(deps));
}

export type Auth = ReturnType<typeof createAuth>;
