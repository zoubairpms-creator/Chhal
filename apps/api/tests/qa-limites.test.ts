import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

// Rôle QA : ces tests cherchent des cas limites. D1 à D4 (Lot 1) sont corrigés et verrouillés ici.
const ADMIN = { authorization: "Bearer jeton-qa" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let butterId: number;
let otherId: number;

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  await seedBasketFixture(h.db);
  app = buildApp(h.db, { adminToken: "jeton-qa", allowTestData: true, today: () => "2026-10-20" });
  otherId = (await app.inject({ url: "/produits?q=sucre" })).json().resultats[0].id;
});
afterAll(async () => {
  await app.close();
  await h.close();
});

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) => app.inject({ method: "POST", url, payload: payload as object, headers });

describe("QA — entrées invalides", () => {
  it("JSON malformé → 4xx, jamais 500", async () => {
    const res = await app.inject({ method: "POST", url: "/paniers/optimiser", payload: "{pas du json", headers: { "content-type": "application/json" } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
  it("identifiant de produit non numérique → 400", async () => {
    expect((await app.inject({ url: "/produits/abc/prix?ville=Casablanca" })).statusCode).toBe(400);
  });
  it("maxMagasins hors {1,2,3,null} → 400 ; 51 articles → 400 ; quantité 0 ou 100 → 400", async () => {
    const a = [{ produitId: butterId, quantite: 1 }];
    expect((await post("/paniers/optimiser", { ville: "Casablanca", articles: a, maxMagasins: 4 })).statusCode).toBe(400);
    const many = Array.from({ length: 51 }, () => ({ produitId: butterId, quantite: 1 }));
    expect((await post("/paniers/optimiser", { ville: "Casablanca", articles: many })).statusCode).toBe(400);
    for (const q of [0, 100, 1.5]) expect((await post("/paniers/optimiser", { ville: "Casablanca", articles: [{ produitId: butterId, quantite: q }] })).statusCode).toBe(400);
  });
  it("ville inconnue → 404 en français", async () => {
    const r = await post("/paniers/optimiser", { ville: "Atlantis", articles: [{ produitId: butterId, quantite: 1 }] });
    expect(r.statusCode).toBe(404);
    expect(r.json().erreur).toMatch(/ville/);
  });
  it("tentative d'injection SQL dans la ville ou la recherche → pas d'erreur serveur, aucune fuite", async () => {
    const evil = "x'; DROP TABLE products; --";
    const r1 = await app.inject({ url: `/produits/${butterId}/prix?ville=${encodeURIComponent(evil)}` });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().resultats).toEqual([]);
    const r2 = await app.inject({ url: `/produits?q=${encodeURIComponent(evil)}` });
    expect(r2.statusCode).toBe(200);
    expect((await app.inject({ url: "/produits" })).json().resultats.length).toBeGreaterThan(0);
  });
  it("recherche : espaces seuls et requête de 10 000 caractères → 200", async () => {
    expect((await app.inject({ url: "/produits?q=%20%20" })).statusCode).toBe(200);
    expect((await app.inject({ url: `/produits?q=${"a".repeat(10000)}` })).statusCode).toBe(200);
  });
});

describe("QA — panier", () => {
  it("articles en double : quantités cumulées, même total que la ligne unique", async () => {
    const dup = (await post("/paniers/optimiser", { ville: "casablanca", articles: [{ produitId: otherId, quantite: 1 }, { produitId: otherId, quantite: 1 }] })).json();
    const single = (await post("/paniers/optimiser", { ville: "Casablanca", articles: [{ produitId: otherId, quantite: 2 }] })).json();
    expect(dup.totalMad).toBe(single.totalMad);
    expect(dup.plan[0].articles).toHaveLength(1);
  });
  it("tous les articles sans prix → plan vide, total 0, pas d'erreur", async () => {
    const r = (await post("/paniers/optimiser", { ville: "Casablanca", articles: [{ produitId: butterId, quantite: 1 }], enseignesExclues: ["al-hari", "marjane", "atacadao", "carrefour", "asswak-assalam"] })).json();
    expect(r.plan).toEqual([]);
    expect(r.totalMad).toBe(0);
    expect(r.exclus).toHaveLength(1);
  });
  it("âge maximum de 1 jour : les prix du 17 sont périmés au 20", async () => {
    const r = (await post("/paniers/optimiser", { ville: "Casablanca", articles: [{ produitId: butterId, quantite: 1 }], ageMaxJours: 1 })).json();
    expect(r.exclus[0].raison).toMatch(/moins de 1 jours/);
  });
});

describe("QA — contributions et administration", () => {
  it("D4 corrigé : un prix à 3 décimales est refusé (400), 79.99 est accepté", async () => {
    const bad = await post("/contributions", { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 79.999 });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().erreur).toMatch(/2 décimales/);
    expect((await post("/contributions", { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 79.99 })).statusCode).toBe(202);
  });
  it("décision invalide → 400 ; observation inconnue → 404 ; produit inconnu → 404", async () => {
    expect((await post("/admin/observations/1/decision", { decision: "peut-etre" }, ADMIN)).statusCode).toBe(400);
    expect((await post("/admin/observations/999999/decision", { decision: "publie" }, ADMIN)).statusCode).toBe(404);
    expect((await post("/contributions", { produitId: 999999, enseigne: "marjane", ville: "Casablanca", prixMad: 5 })).statusCode).toBe(404);
  });
  it("D1 corrigé : la 11e contribution de l'heure est refusée (429)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await post("/contributions", { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 80 + i })).statusCode);
    expect(codes).toContain(429);
  });
  it("jeton de longueur différente ou vide → 401", async () => {
    for (const authorization of ["Bearer ", "Bearer jeton-qa-plus-long", "jeton-qa", "Basic jeton-qa"]) {
      expect((await app.inject({ url: "/admin/en-attente", headers: { authorization } })).statusCode).toBe(401);
    }
  });
});

describe("QA — défauts D2 et D3 corrigés", () => {
  it("D2 corrigé : POST /paniers (écriture publique) est limité en débit", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) codes.push((await post("/paniers", { ville: "Casablanca", articles: [{ produitId: butterId, quantite: 1 }] })).statusCode);
    expect(codes).toContain(429);
  });
  it("D3 corrigé : POST /paniers/optimiser (calcul coûteux) est limité en débit", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 150; i++) codes.push((await post("/paniers/optimiser", { ville: "Casablanca", articles: [{ produitId: butterId, quantite: 1 }] })).statusCode);
    expect(codes).toContain(429);
  });
});

describe("Sécurité — en-têtes et configuration", () => {
  it("S5 : en-têtes de sécurité sur chaque réponse ; HSTS seulement si activé", async () => {
    const r = await app.inject({ url: "/health" });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["referrer-policy"]).toBe("no-referrer");
    expect(r.headers["strict-transport-security"]).toBeUndefined();
    const secure = buildApp(h.db, { hsts: true });
    expect((await secure.inject({ url: "/health" })).headers["strict-transport-security"]).toMatch(/max-age/);
    await secure.close();
  });
  it("S3 : la production refuse de démarrer sans CORS_ORIGIN ou avec des données de test", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/CORS_ORIGIN/);
    expect(() => loadConfig({ NODE_ENV: "production", CORS_ORIGIN: "https://chhal.ma", ALLOW_TEST_DATA: "1" })).toThrow(/ALLOW_TEST_DATA/);
    expect(loadConfig({ NODE_ENV: "production", CORS_ORIGIN: "https://chhal.ma", DATABASE_URL: "postgresql://db.example/chhal", ADMIN_TOKEN: "a".repeat(40) })).toMatchObject({ allowTestData: false, hsts: true });
    expect(loadConfig({}).allowTestData).toBe(false);
  });
  it("S2 : trustProxy, le limiteur distingue deux visiteurs derrière un proxy", async () => {
    const proxied = buildApp(h.db, { trustProxy: true });
    const call = (ip: string) => proxied.inject({ method: "POST", url: "/contributions", headers: { "x-forwarded-for": ip }, payload: { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 80 } });
    for (let i = 0; i < 10; i++) await call("203.0.113.1");
    expect((await call("203.0.113.1")).statusCode).toBe(429);
    expect((await call("203.0.113.2")).statusCode).toBe(202);
    await proxied.close();
  });
});
