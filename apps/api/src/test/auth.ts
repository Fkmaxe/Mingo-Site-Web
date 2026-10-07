import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { account, user } from "../db/schema";
import { getTestDb } from "./db";
import { createTestApp, testEnv } from "./env";

const TEST_PASSWORD = "test-password-123";
let passwordHash: Promise<string> | undefined;

/**
 * Session headers for a user that already exists in the database: gives the user a known
 * password and signs in through the real Better Auth endpoint.
 */
export async function authHeaders(userId: string): Promise<Headers> {
  const db = getTestDb();
  passwordHash ??= hashPassword(TEST_PASSWORD);

  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!row) throw new Error(`Utilisateur de test introuvable : ${userId}`);

  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!credential) {
    await db.insert(account).values({
      userId,
      accountId: userId,
      providerId: "credential",
      password: await passwordHash,
    });
  }

  const res = await createTestApp().request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: row.email, password: TEST_PASSWORD }),
    headers: { "content-type": "application/json", origin: testEnv.WEB_ORIGIN },
  });
  if (res.status !== 200) throw new Error(`Connexion de test refusée (${res.status})`);

  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}
