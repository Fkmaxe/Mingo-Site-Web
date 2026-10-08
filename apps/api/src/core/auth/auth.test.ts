import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { createTestApp, testEnv } from "../../test/env";

type TestApp = ReturnType<typeof createTestApp>;

const password = "correct-horse-battery";

function post(app: TestApp, path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: testEnv.WEB_ORIGIN, ...headers },
  });
}

function signUp(app: TestApp, email: string) {
  return post(app, "/sign-up/email", { name: "Jeanne Durand", email, password });
}

function signIn(app: TestApp, email: string) {
  return post(app, "/sign-in/email", { email, password });
}

/** Extracts the first link of the last mail sent to `to`. */
function linkFromMail(app: TestApp, to: string): URL {
  const match = app.mailer.lastTo(to)?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`Aucun lien dans le mail envoyé à ${to}`);
  return new URL(match[0]);
}

describe("sign-up", () => {
  it("refuses an address outside @myskolae.fr", async () => {
    const app = createTestApp();
    const res = await signUp(app, "jeanne@gmail.com");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "DOMAIN_NOT_ALLOWED" });
    expect(await getTestDb().select().from(user)).toHaveLength(0);
    expect(app.mailer.sent).toHaveLength(0);
  });

  it("creates an unverified account and sends a verification mail", async () => {
    const app = createTestApp();
    const res = await signUp(app, "jeanne@myskolae.fr");
    expect(res.status).toBe(200);
    const [created] = await getTestDb().select().from(user);
    expect(created).toMatchObject({ email: "jeanne@myskolae.fr", emailVerified: false });
    expect(app.mailer.lastTo("jeanne@myskolae.fr")?.subject).toContain("Confirme ton adresse");
  });

  it("ignores privileged fields sent by the client", async () => {
    const app = createTestApp();
    await post(app, "/sign-up/email", {
      name: "Mallory",
      email: "mallory@myskolae.fr",
      password,
      isAdmin: true,
    });
    const [created] = await getTestDb().select().from(user);
    expect(created?.isAdmin).toBe(false);
  });
});

describe("sign-in", () => {
  it("is refused until the email is verified, then accepted", async () => {
    const app = createTestApp();
    await signUp(app, "jeanne@myskolae.fr");

    const before = await signIn(app, "jeanne@myskolae.fr");
    expect(before.status).toBe(403);
    expect(await before.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    const verifyUrl = linkFromMail(app, "jeanne@myskolae.fr");
    const verify = await app.request(`${verifyUrl.pathname}${verifyUrl.search}`);
    expect(verify.status).toBeLessThan(400);
    const [verified] = await getTestDb()
      .select()
      .from(user)
      .where(eq(user.email, "jeanne@myskolae.fr"));
    expect(verified?.emailVerified).toBe(true);

    const after = await signIn(app, "jeanne@myskolae.fr");
    expect(after.status).toBe(200);
    expect(after.headers.get("set-cookie")).toContain("session_token");
  });

  it("rejects a wrong password", async () => {
    const app = createTestApp();
    await signUp(app, "jeanne@myskolae.fr");
    await getTestDb().update(user).set({ emailVerified: true });
    const res = await post(app, "/sign-in/email", {
      email: "jeanne@myskolae.fr",
      password: "wrong-password-123",
    });
    expect(res.status).toBe(401);
  });
});

describe("password reset", () => {
  it("sends a reset link and lets the user choose a new password", async () => {
    const app = createTestApp();
    await signUp(app, "jeanne@myskolae.fr");
    await getTestDb().update(user).set({ emailVerified: true });

    const res = await post(app, "/request-password-reset", {
      email: "jeanne@myskolae.fr",
      redirectTo: `${testEnv.WEB_ORIGIN}/reset-password`,
    });
    expect(res.status).toBe(200);
    const mail = app.mailer.lastTo("jeanne@myskolae.fr");
    expect(mail?.subject).toContain("mot de passe");

    const token = linkFromMail(app, "jeanne@myskolae.fr").pathname.split("/").pop();
    const reset = await post(app, "/reset-password", {
      token,
      newPassword: "a-brand-new-password",
    });
    expect(reset.status).toBe(200);
    const signInWithNew = await post(app, "/sign-in/email", {
      email: "jeanne@myskolae.fr",
      password: "a-brand-new-password",
    });
    expect(signInWithNew.status).toBe(200);
  });
});

describe("confirmation mail sent again", () => {
  it("is not sent by a second sign-up, but by the resend endpoint", async () => {
    const app = createTestApp();
    await signUp(app, "jeanne@myskolae.fr");
    app.mailer.sent.length = 0;

    // Same address again: same answer, no mail (no account enumeration).
    await signUp(app, "jeanne@myskolae.fr");
    expect(app.mailer.lastTo("jeanne@myskolae.fr")).toBeUndefined();

    const res = await post(app, "/send-verification-email", {
      email: "jeanne@myskolae.fr",
      callbackURL: "/home",
    });
    expect(res.status).toBe(200);
    const link = linkFromMail(app, "jeanne@myskolae.fr");
    expect(link.pathname).toContain("verify-email");
  });
});
