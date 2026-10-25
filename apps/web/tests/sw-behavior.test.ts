import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// Le navigateur intégré refuse tout service worker (même trivial) : on exécute donc le VRAI fichier public/sw.js
// dans un bac à sable Node avec de faux caches et un faux réseau, pour vérifier son comportement hors ligne.
const read = (f: string) => readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8");
const key = (r: any) => {
  const u = new URL(typeof r === "string" ? r : r.url, "https://chhal.test");
  return u.pathname + u.search;
};

class FakeCache {
  map = new Map<string, Response>();
  async match(r: any) { return this.map.get(key(r))?.clone(); }
  async put(r: any, res: Response) { this.map.set(key(r), res); }
  async add(u: string) { this.map.set(key(u), new Response("<h1>offline</h1>", { headers: { "content-type": "text/html" } })); }
  async keys() { return [...this.map.keys()].map((k) => ({ url: "https://chhal.test" + k })); }
  async delete(r: any) { return this.map.delete(key(r)); }
}
class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(n: string) { if (!this.stores.has(n)) this.stores.set(n, new FakeCache()); return this.stores.get(n)!; }
  async match(r: any) { for (const c of this.stores.values()) { const h = await c.match(r); if (h) return h; } return undefined; }
  async keys() { return [...this.stores.keys()]; }
  async delete(n: string) { return this.stores.delete(n); }
}

function basic(body: string, init: ResponseInit = {}) {
  const res = new Response(body, init);
  Object.defineProperty(res, "type", { value: "basic" });
  return res;
}

function setup() {
  const listeners: Record<string, (e: any) => void> = {};
  const caches = new FakeCaches();
  const net = { online: true, calls: [] as string[], responder: (u: string): Response => basic(`réseau:${u}`) };
  const ctx: any = {
    self: { addEventListener: (t: string, f: any) => (listeners[t] = f), location: { origin: "https://chhal.test" }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches,
    fetch: async (r: any) => { net.calls.push(key(r)); if (!net.online) throw new TypeError("Failed to fetch"); return net.responder(key(r)); },
    Response, URL,
    importScripts: (f: string) => vm.runInContext(read(f.replace(/^\//, "")), ctx),
  };
  vm.createContext(ctx);
  vm.runInContext(read("sw.js"), ctx);

  const request = (path: string, opts: { method?: string; mode?: string } = {}) => ({ url: "https://chhal.test" + path, method: opts.method ?? "GET", mode: opts.mode ?? "cors" });
  async function fire(req: any): Promise<Response | "ignored"> {
    let p: Promise<Response> | undefined;
    listeners.fetch({ request: req, respondWith: (x: Promise<Response>) => (p = x) });
    if (!p) return "ignored";
    const res = await p;
    await new Promise((r) => setTimeout(r, 5)); // laisse finir l'écriture en cache (non attendue par le worker)
    return res;
  }
  async function lifecycle(type: "install" | "activate") {
    let p: Promise<unknown> | undefined;
    listeners[type]({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  }
  return { caches, net, request, fire, lifecycle };
}

let sw: ReturnType<typeof setup>;
beforeEach(async () => {
  sw = setup();
  await sw.lifecycle("install");
});

describe("service worker — comportement hors ligne (vrai fichier sw.js)", () => {
  it("données : en ligne le réseau répond ; hors ligne la DERNIÈRE réponse enregistrée est servie", async () => {
    const on = (await sw.fire(sw.request("/api-proxy/produits/1/prix?ville=Casablanca"))) as Response;
    expect(await on.text()).toBe("réseau:/api-proxy/produits/1/prix?ville=Casablanca");
    sw.net.online = false;
    const off = (await sw.fire(sw.request("/api-proxy/produits/1/prix?ville=Casablanca"))) as Response;
    expect(off.status).toBe(200);
    expect(await off.text()).toBe("réseau:/api-proxy/produits/1/prix?ville=Casablanca");
  });

  it("un prix perime en cache n'est jamais rendu comme actuel",async()=>{
    const now=new Date();now.setDate(now.getDate()-1);
    sw.net.responder=()=>basic(JSON.stringify({resultats:[{prixMad:1,validUntil:now.toISOString().slice(0,10)}]}),{headers:{"content-type":"application/json"}});
    await sw.fire(sw.request("/api-proxy/produits/1/prix"));
    sw.net.online=false;
    expect(((await sw.fire(sw.request("/api-proxy/produits/1/prix")))as Response).status).toBe(503);
  });
  it("le repli hors ligne est date et explicitement marque",async()=>{
    await sw.fire(sw.request("/api-proxy/produits"));
    sw.net.online=false;
    const r=await sw.fire(sw.request("/api-proxy/produits")) as Response;
    expect(r.headers.get("x-chhal-offline")).toBe("1");expect(r.headers.get("x-chhal-cached-at")).toBeTruthy();
  });
  it("un cache de plus de six heures est refuse",async()=>{
    const c=await sw.caches.open("chhal-data-v2");
    await c.put(sw.request("/api-proxy/produits"),basic("{}",{headers:{"x-chhal-cached-at":"2000-01-01T00:00:00Z","x-chhal-cache-day":"2000-01-01"}}));
    sw.net.online=false;expect(((await sw.fire(sw.request("/api-proxy/produits")))as Response).status).toBe(503);
  });
  it("données jamais vues + hors ligne : 503 JSON en français, pas de plantage", async () => {
    sw.net.online = false;
    const res = (await sw.fire(sw.request("/api-proxy/produits?q=riz"))) as Response;
    expect(res.status).toBe(503);
    expect((await res.json()).erreur).toMatch(/Hors ligne/);
  });

  it("pages : revisite hors ligne = dernière version ; page jamais visitée = offline.html", async () => {
    await sw.fire(sw.request("/fr", { mode: "navigate" }));
    sw.net.online = false;
    expect(await ((await sw.fire(sw.request("/fr", { mode: "navigate" }))) as Response).text()).toBe("réseau:/fr");
    const unknown = (await sw.fire(sw.request("/fr/panier", { mode: "navigate" }))) as Response;
    expect(await unknown.text()).toContain("offline");
  });

  it("fichiers statiques : cache d'abord (une seule requête réseau)", async () => {
    await sw.fire(sw.request("/_next/static/chunks/a.js", { mode: "no-cors" }));
    await sw.fire(sw.request("/_next/static/chunks/a.js", { mode: "no-cors" }));
    expect(sw.net.calls.filter((c) => c === "/_next/static/chunks/a.js")).toHaveLength(1);
  });

  it("écritures et administration : jamais interceptées ni enregistrées", async () => {
    expect(await sw.fire(sw.request("/api-proxy/paniers", { method: "POST" }))).toBe("ignored");
    expect(await sw.fire(sw.request("/api-proxy/admin/en-attente"))).toBe("ignored");
    expect(await sw.fire(sw.request("/fr/admin", { mode: "navigate" }))).toBe("ignored");
    const stored = [...sw.caches.stores.values()].flatMap((c) => [...c.map.keys()]);
    expect(stored.some((k) => k.includes("admin") || k.includes("/api-proxy/paniers"))).toBe(false);
  });

  it("réponses d'erreur (500) : jamais mises en cache", async () => {
    sw.net.responder = () => basic("boom", { status: 500 });
    await sw.fire(sw.request("/api-proxy/villes"));
    sw.net.online = false;
    expect(((await sw.fire(sw.request("/api-proxy/villes"))) as Response).status).toBe(503);
  });

  it("autre origine : ignorée", async () => {
    expect(await sw.fire({ url: "https://exemple.org/x.js", method: "GET", mode: "no-cors" })).toBe("ignored");
  });

  it("activation : les anciens caches « chhal-* » d'une autre version sont supprimés, les autres sites épargnés", async () => {
    await sw.caches.open("chhal-static-v0");
    await sw.caches.open("autre-site");
    await sw.lifecycle("activate");
    const names = await sw.caches.keys();
    expect(names).not.toContain("chhal-static-v0");
    expect(names).toContain("autre-site");
    expect(names).toContain("chhal-pages-v2");
  });
});
