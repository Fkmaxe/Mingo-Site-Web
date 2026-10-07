import { createAuthClient } from "better-auth/react";

/** Better Auth client, called from the browser through the web origin (/api/auth proxy). */
export const authClient = createAuthClient();
