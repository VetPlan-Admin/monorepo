import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Clears the session cookie. POST-only so links and prefetches can't sign users out. */
export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
