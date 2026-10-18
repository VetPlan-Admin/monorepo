/**
 * Same-origin proxy ("backend for frontend") for client components: the browser calls
 * `/api/backend/...` and the Next.js server forwards the request with the access token from the
 * HTTP-only session cookie, so the token never reaches client-side JavaScript.
 */

/** Only these API areas are reachable through the proxy (auth flows keep their own routes). */
export const PROXIED_PREFIXES = ["health", "auth/me", "patients", "cases"] as const;

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition"];

export function isProxiedPath(segments: readonly string[]): boolean {
  if (segments.length === 0 || segments.some((s) => s === "" || s === "." || s === "..")) {
    return false;
  }
  const path = segments.join("/");
  return PROXIED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function json(status: number, message: string): Response {
  return Response.json({ message }, { status });
}

export interface ProxyOptions {
  apiUrl: string;
  /** Access token from the session cookie, if any (public endpoints work without it). */
  token?: string;
  fetchImpl?: typeof fetch;
}

export async function proxyToBackend(
  request: Request,
  segments: readonly string[],
  { apiUrl, token, fetchImpl = fetch }: ProxyOptions,
): Promise<Response> {
  if (!isProxiedPath(segments)) {
    return json(404, "Not found");
  }

  // CSRF defence in depth (the cookie is already SameSite=Lax): writes must come from our own pages
  const requestUrl = new URL(request.url);
  if (!SAFE_METHODS.has(request.method) && request.headers.get("origin") !== requestUrl.origin) {
    return json(403, "Cross-origin request rejected");
  }

  const headers: Record<string, string> = { Accept: request.headers.get("accept") ?? "application/json" };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (token) headers.Authorization = `Bearer ${token}`;

  const target = `${apiUrl.replace(/\/+$/, "")}/${segments.map(encodeURIComponent).join("/")}${requestUrl.search}`;
  let upstream: Response;
  try {
    upstream = await fetchImpl(target, {
      method: request.method,
      headers,
      body: SAFE_METHODS.has(request.method) ? undefined : await request.text(),
      cache: "no-store",
    });
  } catch {
    return json(502, "Vet Plan API is unreachable");
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
}
