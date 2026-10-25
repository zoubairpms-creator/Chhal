import { describe, expect, it, vi } from "vitest";
import { proxyToApi } from "../lib/proxy";
const request = (path = "/produits?q=lait&ville=Casablanca", init?: RequestInit) =>
  new Request("https://chhal.example/api-proxy" + path, init);

describe("proxy API pour Node et Workers", () => {
  it("conserve chemin, recherche et statut sans cache HTTP", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"resultats":[]}', { headers: { "content-type": "application/json", "set-cookie": "secret=1" } }));
    const res = await proxyToApi(request(), { apiUrl: "https://api.example/", fetcher });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.example/produits?q=lait&ville=Casablanca");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({ resultats: [] });
  });
  it("relaie le POST et le jeton du navigateur sans cookies ni IP usurpee", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 202 }));
    const res = await proxyToApi(request("/contributions", { method: "POST", body: '{"prixMad":12}', headers: { authorization: "Bearer navigateur", "content-type": "application/json", cookie: "session=secret", "x-forwarded-for": "usurpee" } }), { fetcher });
    const init = fetcher.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"prixMad":12}');
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer navigateur");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(res.status).toBe(202);
  });
  it("conserve 401, 429 et Retry-After", async () => {
    for (const status of [401, 429]) {
      const res = await proxyToApi(request("/admin/en-attente"), { fetcher: async () => new Response('{"erreur":"refus"}', { status, headers: { "retry-after": "60" } }) });
      expect(res.status).toBe(status);
      expect(res.headers.get("retry-after")).toBe("60");
    }
  });
  it.each([undefined, "http://api.example", "https://user:secret@api.example", "https://api.example/base", "https://api.example?token=secret"])("refuse une cible de production invalide (%s)", async (apiUrl) => {
    const fetcher = vi.fn();
    expect((await proxyToApi(request(), { apiUrl, production: true, fetcher })).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("un chemin encode ne change jamais l'origine cible", async () => {
    const fetcher = vi.fn();
    for (const path of ["/%2f%2fevil.example", "/%5cevil.example", "/%2e%2e%2fadmin"]) {
      expect((await proxyToApi(request(path), { fetcher })).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("ne suit pas de redirection avec le jeton", async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 302, headers: { location: "https://evil.example" } }));
    expect((await proxyToApi(request(), { fetcher })).status).toBe(502);
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
  });
  it("masque les erreurs internes et distingue le delai depasse", async () => {
    for (const name of ["Error", "TimeoutError"]) {
      const res = await proxyToApi(request(), { fetcher: async () => { throw Object.assign(new Error("secret interne"), { name }); } });
      expect(res.status).toBe(name === "TimeoutError" ? 504 : 502);
      expect(await res.text()).not.toContain("secret interne");
    }
  });
  it("refuse un corps trop grand avant de contacter l'API", async () => {
    const fetcher = vi.fn();
    expect((await proxyToApi(request("/contributions", { method: "POST", body: "x".repeat(1_048_577) }), { fetcher })).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("HEAD et 204 ne renvoient aucun corps", async () => {
    const head = await proxyToApi(request("/health", { method: "HEAD" }), { fetcher: async () => new Response(null) });
    const empty = await proxyToApi(request(), { fetcher: async () => new Response(null, { status: 204 }) });
    expect(await head.text()).toBe("");
    expect(empty.status).toBe(204);
  });
});
