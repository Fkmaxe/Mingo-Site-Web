import type { ApiErrorBody, ErrorCode } from "@bde/shared";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError } from "zod";

export class AppError extends Error {
  override readonly name = "AppError";

  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function validationError(error: ZodError): AppError {
  return new AppError("VALIDATION_ERROR", 400, "Certaines données envoyées sont invalides.", {
    issues: error.issues,
  });
}

/** `defaultHook` for OpenAPIHono: every request validation failure goes through `onError`. */
export function throwOnValidationError(
  result: { success: true } | { success: false; error: ZodError },
): void {
  if (!result.success) throw validationError(result.error);
}

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  // Malformed JSON body and similar framework-level rejections.
  if (err instanceof HTTPException && err.status === 400) {
    return c.json(errorBody("VALIDATION_ERROR", "La requête est mal formée."), 400);
  }
  console.error(err);
  return c.json(errorBody("INTERNAL_ERROR", "Une erreur inattendue est survenue."), 500);
};

export const onNotFound: NotFoundHandler = (c) =>
  c.json(errorBody("NOT_FOUND", "Cette ressource n'existe pas."), 404);
