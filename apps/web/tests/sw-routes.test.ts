import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { chhalStrategy } = require("../public/sw-routes.js") as { chhalStrategy: (p: string, m: string, mode: string) => string };

describe("stratégie du service worker", () => {
  it("n'enregistre JAMAIS les écritures ni l'administration", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(chhalStrategy("/api-proxy/paniers", m, "cors")).toBe("network-only");
    expect(chhalStrategy("/api-proxy/admin/en-attente", "GET", "cors")).toBe("network-only");
    expect(chhalStrategy("/api-proxy/admin/releves/import", "POST", "cors")).toBe("network-only");
    expect(chhalStrategy("/fr/admin", "GET", "navigate")).toBe("network-only");
    expect(chhalStrategy("/ar/admin", "GET", "navigate")).toBe("network-only");
  });
  it("fichiers à empreinte et icônes : cache d'abord", () => {
    expect(chhalStrategy("/_next/static/chunks/abc.js", "GET", "no-cors")).toBe("cache-first");
    expect(chhalStrategy("/icons/icon-192.png", "GET", "no-cors")).toBe("cache-first");
  });
  it("données de l'API en lecture : réseau d'abord avec repli sur la dernière réponse", () => {
    for (const p of ["/api-proxy/villes", "/api-proxy/produits", "/api-proxy/produits/1/prix", "/api-proxy/paniers-prets", "/api-proxy/paniers/xyz"]) {
      expect(chhalStrategy(p, "GET", "cors"), p).toBe("network-first-data");
    }
  });
  it("pages : réseau d'abord avec repli sur la dernière version visitée", () => {
    expect(chhalStrategy("/fr", "GET", "navigate")).toBe("network-first-page");
    expect(chhalStrategy("/ar/rapport/panier", "GET", "navigate")).toBe("network-first-page");
  });
  it("le reste passe par le réseau", () => {
    expect(chhalStrategy("/autre.json", "GET", "cors")).toBe("network-only");
  });
});
