import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Better Auth client, called from the browser through the web origin (/api/auth proxy). */
export const authClient = createAuthClient({
  plugins: [
    // Extra sign-up fields declared in the API's Better Auth config (apps/api/src/core/auth).
    inferAdditionalFields({
      user: { firstName: { type: "string" }, lastName: { type: "string" } },
    }),
    // Sign-in and address confirmation with a 6-digit code by mail.
    emailOTPClient(),
    // Face ID, fingerprint, phone screen lock.
    passkeyClient(),
  ],
});
