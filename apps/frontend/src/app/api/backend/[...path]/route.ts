import type { NextRequest } from "next/server";
import { API_URL } from "@/lib/api";
import { proxyToBackend } from "@/lib/backend-proxy";
import { SESSION_COOKIE } from "@/lib/session-cookie";

async function handle(request: NextRequest, { params }: RouteContext<"/api/backend/[...path]">) {
  const { path } = await params;
  return proxyToBackend(request, path, { apiUrl: API_URL, token: request.cookies.get(SESSION_COOKIE)?.value });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
