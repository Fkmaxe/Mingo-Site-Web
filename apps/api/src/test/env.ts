import type { AppDeps } from "../app";

export const testEnv: AppDeps["env"] = {
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost:3000",
};
