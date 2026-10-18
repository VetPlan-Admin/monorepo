import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session-cookie";

/**
 * Optimistic check for the clinical workspace: no session cookie → login page.
 * The backend still validates the token on every API call; this only spares users a dead end.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/planner/:path*", "/cases/:path*"],
};
