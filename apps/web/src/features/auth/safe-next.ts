/** Only same-site paths are accepted as post-login destinations (no open redirect). */
export function safeNextPath(next: string | undefined | null, fallback = "/home"): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
