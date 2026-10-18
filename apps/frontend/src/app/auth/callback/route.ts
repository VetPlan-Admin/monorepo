import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { AccessTokenResponseDto } from "@vet-plan/shared";
import { API_URL } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * OAuth landing page: the backend redirects here with a one-minute code.
 * Swap it server-to-server for an access token and keep that in an HTTP-only cookie,
 * so the token never reaches client-side JavaScript.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectToLogin(request, "missing_code");
  }

  let token: AccessTokenResponseDto;
  try {
    const exchange = await fetch(`${API_URL}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!exchange.ok) {
      return redirectToLogin(request, "exchange_failed");
    }
    token = (await exchange.json()) as AccessTokenResponseDto;
  } catch {
    return redirectToLogin(request, "backend_unavailable");
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, token.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: token.expiresIn,
  });
  return response;
}
