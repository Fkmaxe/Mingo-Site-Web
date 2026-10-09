import { parseEnv } from "@bde/shared";
import { z } from "zod";

const EnvSchema = z.object({
  /** API base URL used by server components (inside Docker: http://api:3001). */
  API_URL: z.url(),
  /** Public URL of the site: canonical links, sitemap, structured data. */
  SITE_URL: z.url().default("https://bde-mingo.fr"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return parseEnv(EnvSchema, source);
}
