import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Better Auth client, called from the browser through the web origin (/api/auth proxy). */
export const authClient = createAuthClient({
  // Extra sign-up fields declared in the API's Better Auth config (apps/api/src/core/auth).
  plugins: [
    inferAdditionalFields({
      user: { firstName: { type: "string" }, lastName: { type: "string" } },
    }),
  ],
});
