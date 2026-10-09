export const DEFAULT_AFTER_LOGIN = "/home";

/** Only same-site paths are accepted as post-login destinations (no open redirect). */
export function safeNextPath(
  next: string | undefined | null,
  fallback = DEFAULT_AFTER_LOGIN,
): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

/**
 * Link to an auth page (`/login`, `/signup`…) that brings the user back to `next` afterwards.
 * The parameter is dropped when it is unsafe or the default destination, to keep URLs short.
 */
export function authHref(
  page: string,
  next: string | undefined | null,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams(extra);
  const destination = safeNextPath(next);
  if (destination !== DEFAULT_AFTER_LOGIN) params.set("next", destination);
  const query = params.toString();
  return query ? `${page}?${query}` : page;
}
