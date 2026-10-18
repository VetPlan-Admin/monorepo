import "server-only";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import type { CurrentUserDto } from "@vet-plan/shared";
import { API_URL } from "./api";

/** HTTP-only cookie holding the backend access token (set by /auth/callback). */
export const SESSION_COOKIE = "vp_session";

/**
 * The signed-in user, or null. Reads the session cookie at request time,
 * so callers must render inside a <Suspense> boundary (Cache Components).
 */
export async function getCurrentUser(): Promise<CurrentUserDto | null> {
  "use cache: private";
  cacheLife({ stale: 60 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok ? ((await response.json()) as CurrentUserDto) : null;
  } catch (error) {
    console.error("Session lookup failed: backend unreachable", error);
    return null;
  }
}
