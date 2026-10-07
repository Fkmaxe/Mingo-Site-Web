import type { z } from "zod";

/**
 * Parses environment variables with the given schema. Throws a readable error listing every
 * invalid variable, so a misconfigured deployment fails at startup instead of at the first request.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Variables d'environnement invalides :\n${lines.join("\n")}`);
  }
  return result.data;
}
