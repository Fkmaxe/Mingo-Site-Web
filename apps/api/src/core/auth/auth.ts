import {
  ALLOWED_EMAIL_DOMAIN,
  composeName,
  isAllowedEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PersonNameFields,
  splitName,
} from "@bde/shared";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { z } from "zod";
import type { Db } from "../../db/client";
import { account, passkey, session, user, verification } from "../../db/schema";
import type { Env } from "../../env";
import type { Mailer } from "../../lib/mailer";
import { writeAudit } from "../audit";
import { otpEmail, resetPasswordEmail } from "./emails";

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
const WithId = z.object({ id: z.string() });

/** Changes to the ways of signing in, recorded in the audit log. */
const PASSKEY_AUDIT: Record<string, { action: string; idFrom: "body" | "returned" }> = {
  "/passkey/verify-registration": { action: "passkey.added", idFrom: "returned" },
  "/passkey/delete-passkey": { action: "passkey.deleted", idFrom: "body" },
};
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
      schema: { user, session, account, verification, passkey },
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
    // The mail itself comes from the emailOTP plugin below (a code, not a link): declaring
    // sendVerificationEmail here would take precedence over it.
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    plugins: [
      // Sign in with a 6-digit code by mail, and confirm the address with a code instead of a
      // link (far less often quarantined by Microsoft 365). No account is created this way:
      // sign-up asks for first and last name.
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 3,
        disableSignUp: true,
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          await mailer.send(otpEmail(email, otp, type));
        },
      }),
      // Face ID, fingerprint or the phone's screen lock, bound to the web domain.
      passkeyPlugin({
        rpID: new URL(env.WEB_ORIGIN).hostname,
        rpName: "BDE Mingo",
        origin: env.WEB_ORIGIN,
      }),
    ],
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
      after: createAuthMiddleware(async (ctx) => {
        const audited = PASSKEY_AUDIT[ctx.path];
        const userId = ctx.context.session?.user.id;
        if (!audited || !userId || ctx.context.returned instanceof APIError) return;
        const target = WithId.safeParse(
          audited.idFrom === "body" ? ctx.body : ctx.context.returned,
        );
        await writeAudit(db, {
          actorUserId: userId,
          action: audited.action,
          entity: "passkey",
          entityId: target.success ? target.data.id : null,
        });
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
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
        "/email-otp/verify-email": { window: 60, max: 5 },
        "/passkey/verify-authentication": { window: 60, max: 10 },
      },
    },
  };
}

export function createAuth(deps: AuthDeps) {
  return betterAuth(authOptions(deps));
}

export type Auth = ReturnType<typeof createAuth>;
