import type { components } from "./api-schema";

type ApiError = components["schemas"]["ApiError"];

/** What a server action returns to its form. Success usually redirects instead. */
export type ActionResult =
  | { ok: true }
  | { ok: false; code: string; message: string; fieldErrors: Record<string, string> };

/** Turns an API error body into a form result, mapping Zod issues to field errors. */
export function fromApiError(error: ApiError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  const details = error.error.details;
  if (
    details &&
    typeof details === "object" &&
    "issues" in details &&
    Array.isArray(details.issues)
  ) {
    for (const issue of details.issues) {
      const field = issue?.path?.[0];
      if (typeof field === "string" && typeof issue.message === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
  }
  return { ok: false, code: error.error.code, message: error.error.message, fieldErrors };
}
