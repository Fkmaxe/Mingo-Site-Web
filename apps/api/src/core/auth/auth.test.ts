import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, passkey, user } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testEnv } from "../../test/env";
import { createUser } from "../../test/factories";

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
  return post(app, "/sign-up/email", {
    name: "Jeanne Durand",
    firstName: "Jeanne",
    lastName: "Durand",
    email,
    password,
  });
}

function signIn(app: TestApp, email: string) {
  return post(app, "/sign-in/email", { email, password });
}

/** The 6-digit code of the last mail sent to `to`. */
function codeFromMail(app: TestApp, to: string): string {
  const match = app.mailer.lastTo(to)?.text.match(/Code : (\d{6})/);
  if (!match?.[1]) throw new Error(`Aucun code dans le mail envoyé à ${to}`);
  return match[1];
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
    expect(created).toMatchObject({
      email: "jeanne@myskolae.fr",
      emailVerified: false,
      firstName: "Jeanne",
      lastName: "Durand",
      name: "Jeanne Durand",
    });
    const mail = app.mailer.lastTo("jeanne@myskolae.fr");
    expect(mail?.subject).toMatch(/^\d{6} est ton code de confirmation BDE Mingo$/);
    // A code, no link to click: mail filters flag those far less.
    expect(mail?.html).not.toContain("verify-email");
  });

  it("stores trimmed names and derives `name` from them, whatever the client sent", async () => {
    const app = createTestApp();
    const res = await post(app, "/sign-up/email", {
      name: "Autre chose",
      firstName: "  Jean ",
      lastName: " de La Tour ",
      email: "jean@myskolae.fr",
      password,
    });
    expect(res.status).toBe(200);
    const [created] = await getTestDb().select().from(user);
    expect(created).toMatchObject({
      firstName: "Jean",
      lastName: "de La Tour",
      name: "Jean de La Tour",
    });
  });

  it("refuses a sign-up without a last name", async () => {
    const app = createTestApp();
    const res = await post(app, "/sign-up/email", {
      name: "Jeanne",
      firstName: "Jeanne",
      lastName: "  ",
      email: "jeanne@myskolae.fr",
      password,
    });
    expect(res.status).toBe(400);
    expect(await getTestDb().select().from(user)).toHaveLength(0);
  });

  it("ignores privileged fields sent by the client", async () => {
    const app = createTestApp();
    await post(app, "/sign-up/email", {
      name: "Mallory Martin",
      firstName: "Mallory",
      lastName: "Martin",
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

    // The refused sign-in sent a new code.
    const wrong = await post(app, "/email-otp/verify-email", {
      email: "jeanne@myskolae.fr",
      otp: "000000",
    });
    expect(wrong.status).toBe(400);
    const verify = await post(app, "/email-otp/verify-email", {
      email: "jeanne@myskolae.fr",
      otp: codeFromMail(app, "jeanne@myskolae.fr"),
    });
    expect(verify.status).toBe(200);
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

    const res = await post(app, "/email-otp/send-verification-otp", {
      email: "jeanne@myskolae.fr",
      type: "email-verification",
    });
    expect(res.status).toBe(200);
    expect(codeFromMail(app, "jeanne@myskolae.fr")).toMatch(/^\d{6}$/);
  });
});

describe("update-user", () => {
  it("is blocked: profile changes go through PATCH /v1/me (audited)", async () => {
    const app = createTestApp();
    await signUp(app, "jeanne@myskolae.fr");
    await getTestDb().update(user).set({ emailVerified: true });
    const session = await signIn(app, "jeanne@myskolae.fr");
    const cookie = session.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    const res = await post(app, "/update-user", { firstName: "Mallory" }, { cookie });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "PROFILE_UPDATE_NOT_ALLOWED" });
    const [unchanged] = await getTestDb().select().from(user);
    expect(unchanged?.firstName).toBe("Jeanne");
  });
});

describe("sign-in with a code by mail", () => {
  async function verifiedAccount(app: TestApp, email: string) {
    await signUp(app, email);
    await post(app, "/email-otp/verify-email", { email, otp: codeFromMail(app, email) });
    app.mailer.sent.length = 0;
  }

  it("sends a 6-digit code, then signs in with it, once", async () => {
    const app = createTestApp();
    await verifiedAccount(app, "jeanne@myskolae.fr");
    const sent = await post(app, "/email-otp/send-verification-otp", {
      email: "jeanne@myskolae.fr",
      type: "sign-in",
    });
    expect(sent.status).toBe(200);
    const mail = app.mailer.lastTo("jeanne@myskolae.fr");
    expect(mail?.subject).toMatch(/^\d{6} est ton code de connexion BDE Mingo$/);
    const otp = codeFromMail(app, "jeanne@myskolae.fr");

    const ok = await post(app, "/sign-in/email-otp", { email: "jeanne@myskolae.fr", otp });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("session_token");

    const reused = await post(app, "/sign-in/email-otp", { email: "jeanne@myskolae.fr", otp });
    expect(reused.status).toBeGreaterThanOrEqual(400);
  });

  it("locks the code after 3 wrong attempts", async () => {
    const app = createTestApp();
    await verifiedAccount(app, "jeanne@myskolae.fr");
    await post(app, "/email-otp/send-verification-otp", {
      email: "jeanne@myskolae.fr",
      type: "sign-in",
    });
    const otp = codeFromMail(app, "jeanne@myskolae.fr");
    const wrong = otp === "111111" ? "222222" : "111111";
    for (let i = 0; i < 3; i++) {
      await post(app, "/sign-in/email-otp", { email: "jeanne@myskolae.fr", otp: wrong });
    }
    const late = await post(app, "/sign-in/email-otp", { email: "jeanne@myskolae.fr", otp });
    expect(late.status).toBeGreaterThanOrEqual(400);
  });

  it("never creates an account (sign-up asks for the names)", async () => {
    const app = createTestApp();
    await post(app, "/email-otp/send-verification-otp", {
      email: "nouveau@myskolae.fr",
      type: "sign-in",
    });
    const otp =
      app.mailer.lastTo("nouveau@myskolae.fr")?.text.match(/Code : (\d{6})/)?.[1] ?? "123456";
    const res = await post(app, "/sign-in/email-otp", { email: "nouveau@myskolae.fr", otp });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await getTestDb().select().from(user)).toHaveLength(0);
  });
});

describe("passkeys", () => {
  it("offer registration to a signed-in user only, for the web's domain", async () => {
    const app = createTestApp();
    const anonymous = await app.request("/api/auth/passkey/generate-register-options", {
      headers: { origin: testEnv.WEB_ORIGIN },
    });
    expect(anonymous.status).toBe(401);

    const account = await createUser();
    const headers = await authHeaders(account.id);
    headers.set("origin", testEnv.WEB_ORIGIN);
    const res = await app.request("/api/auth/passkey/generate-register-options", { headers });
    expect(res.status).toBe(200);
    const options = (await res.json()) as {
      rp: { id: string; name: string };
      user: { name: string };
    };
    expect(options.rp).toEqual({ id: "localhost", name: "BDE Mingo" });
    expect(options.user.name).toBe(account.email);
  });

  it("let anyone start a passkey sign-in (the browser picks the credential)", async () => {
    const app = createTestApp();
    const res = await app.request("/api/auth/passkey/generate-authenticate-options", {
      headers: { origin: testEnv.WEB_ORIGIN },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rpId: "localhost" });
  });
});

const OWNER_PASSKEY = "8f8b5f0e-3c1a-4d2e-9b7a-1a2b3c4d5e6f";
const OTHER_PASSKEY = "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("passkey deletion", () => {
  it("removes only the user's own passkey and writes the audit log", async () => {
    const app = createTestApp();
    const owner = await createUser();
    const other = await createUser();
    const row = (userId: string, id: string) => ({
      id,
      name: "iPhone",
      publicKey: "pk",
      userId,
      credentialID: `cred-${id}`,
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
      transports: "internal",
    });
    await getTestDb()
      .insert(passkey)
      .values([row(owner.id, OWNER_PASSKEY), row(other.id, OTHER_PASSKEY)]);
    const headers = await authHeaders(owner.id);
    headers.set("origin", testEnv.WEB_ORIGIN);
    headers.set("content-type", "application/json");
    const [mine, theirs] = [OWNER_PASSKEY, OTHER_PASSKEY];
    const del = (id: string) =>
      app.request("/api/auth/passkey/delete-passkey", {
        method: "POST",
        headers,
        body: JSON.stringify({ id }),
      });

    expect((await del(theirs)).status).toBeGreaterThanOrEqual(400);
    expect((await del(mine)).status).toBe(200);
    const left = await getTestDb().select({ id: passkey.id }).from(passkey);
    expect(left).toEqual([{ id: theirs }]);
    const audit = await getTestDb().select().from(auditLog);
    expect(audit).toEqual([
      expect.objectContaining({
        actorUserId: owner.id,
        action: "passkey.deleted",
        entityId: mine,
      }),
    ]);
  });
});
