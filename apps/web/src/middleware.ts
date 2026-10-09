import { type NextRequest, NextResponse } from "next/server";

import { PATHNAME_HEADER } from "@/lib/request-path";

/**
 * No auth logic here (the API and `requireMe()` decide): server layouts cannot see the URL,
 * so the path is passed on in a header. Always overwritten, never trusted from the client.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not static files, Next internals or the auth proxy.
  matcher: ["/((?!_next/|api/|icons/|.*\\.[a-z0-9]+$).*)"],
};
