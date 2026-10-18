import { describe, expect, it, vi } from "vitest";
import { isProxiedPath, proxyToBackend } from "./backend-proxy";

const API = "http://api.test";

describe("isProxiedPath", () => {
  it("allows only the listed API areas", () => {
    expect(isProxiedPath(["cases"])).toBe(true);
    expect(isProxiedPath(["cases", "abc", "report"])).toBe(true);
    expect(isProxiedPath(["auth", "me"])).toBe(true);
    expect(isProxiedPath(["auth", "exchange"])).toBe(false);
    expect(isProxiedPath(["casesX"])).toBe(false);
    expect(isProxiedPath(["cases", "..", "auth", "exchange"])).toBe(false);
    expect(isProxiedPath([])).toBe(false);
  });
});

describe("proxyToBackend", () => {
  it("forwards GETs with the session token and query string", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('{"items":[]}', {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": "evil=1", "content-disposition": "attachment" },
      }),
    );
    const response = await proxyToBackend(new Request("http://app.test/api/backend/cases?status=PLANNED"), ["cases"], {
      apiUrl: `${API}/`,
      token: "abc",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(`${API}/cases?status=PLANNED`, expect.objectContaining({ method: "GET", body: undefined }));
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ Authorization: "Bearer abc" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"items":[]}');
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("forwards same-origin writes with their body", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const request = new Request("http://app.test/api/backend/cases/1", {
      method: "PATCH",
      headers: { origin: "http://app.test", "content-type": "application/json" },
      body: '{"status":"PLANNED"}',
    });
    const response = await proxyToBackend(request, ["cases", "1"], { apiUrl: API, fetchImpl });
    expect(response.status).toBe(204);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init).toMatchObject({ method: "PATCH", body: '{"status":"PLANNED"}' });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("rejects cross-origin writes, unlisted paths and reports an unreachable API", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const crossOrigin = new Request("http://app.test/api/backend/cases", { method: "POST", headers: { origin: "http://evil.test" }, body: "{}" });
    expect((await proxyToBackend(crossOrigin, ["cases"], { apiUrl: API, fetchImpl })).status).toBe(403);
    const noOrigin = new Request("http://app.test/api/backend/cases", { method: "DELETE" });
    expect((await proxyToBackend(noOrigin, ["cases"], { apiUrl: API, fetchImpl })).status).toBe(403);
    expect((await proxyToBackend(new Request("http://app.test/api/backend/auth/exchange"), ["auth", "exchange"], { apiUrl: API, fetchImpl })).status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();

    const down = await proxyToBackend(new Request("http://app.test/api/backend/health"), ["health"], { apiUrl: API, fetchImpl });
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ message: "Vet Plan API is unreachable" });
  });
});
