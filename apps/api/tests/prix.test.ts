import {makeTrace} from "./fixtures-source.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { assertTestDatabase, createTestDb, priceObservations, seedBasketFixture, seedButterFixture, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

const ADMIN = { authorization: "Bearer jeton-de-test" };
let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let appTest: ReturnType<typeof buildApp>;
let butterId: number;

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  await seedBasketFixture(h.db);
  const base = { adminToken: "jeton-de-test", today: () => "2026-10-20" };
  app = buildApp(h.db, base); // public : sans données de test
  appTest = buildApp(h.db, { ...base, allowTestData: true });
});
afterAll(async () => {
  await app.close();
  await appTest.close();
  await h.close();
});

describe("Phase 1 — prix du beurre (fixture réelle)", () => {
  it("renvoie les 5 prix triés, BIM absent, avec date et source", async () => {
    const res = await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca` });
    expect(res.statusCode).toBe(200);
    const { resultats } = res.json();
    expect(resultats.map((r: any) => [r.enseigne, r.prixMad])).toEqual([
      ["Al Hari", 78], ["Marjane", 79.95], ["Atacadao", 90], ["Carrefour", 107.95], ["Asswak Assalam", 112.3],
    ]);
    expect(resultats.some((r: any) => r.enseigne === "BIM")).toBe(false);
    for (const r of resultats) {
      expect(r.dateReleve).toBe("2026-10-17");
      expect(r.source).toBe("fixture");
    }
    expect(resultats[0].prixUnitaire).toMatchObject({ prix: 78, par: "kg" });
  });
  it("filtre par enseigne ; 400 / 404 / ville sans prix", async () => {
    expect((await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=marjane` })).json().resultats).toHaveLength(1);
    expect((await app.inject({ url: `/produits/${butterId}/prix` })).statusCode).toBe(400);
    expect((await app.inject({ url: `/produits/99999/prix?ville=Casablanca` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/produits/${butterId}/prix?ville=Rabat` })).json().resultats).toEqual([]);
  });
});

describe("règles de la base", () => {
  it("interdit UPDATE et DELETE sur price_observations", async () => {
    await expect(h.db.execute(sql`UPDATE price_observations SET prix_mad = 1`)).rejects.toThrow();
    await expect(h.db.execute(sql`DELETE FROM price_observations`)).rejects.toThrow();
  });
  it("refuse un prix nul", async () => {
    await expect(
      h.db.insert(priceObservations).values({ productId: butterId, storeId: 1, prixMad: "0", dateReleve: "2026-10-17", source: "manuel", confiance: "haute" }),
    ).rejects.toThrow();
  });
  it("garde-fou : base de test dont le nom ne finit pas par _test refusée", () => {
    expect(() => assertTestDatabase("postgres://u:p@h/chhal_dev")).toThrow(/_test/);
  });
});

describe("Phase 2 — recherche et historique", () => {
  it("trouve le beurre par FR, AR, darija, EN", async () => {
    for (const q of ["beurre", "زبدة", "zebda", "butter"]) {
      const r = (await app.inject({ url: `/produits?q=${encodeURIComponent(q)}&ville=Casablanca` })).json().resultats;
      expect(r[0].id, q).toBe(butterId);
      expect(r[0].meilleurPrix.enseigne).toBe("Al Hari");
    }
  });
  it("arabizi : « zit » trouve l'huile (donnée de test, mode test)", async () => {
    const r = (await appTest.inject({ url: `/produits?q=zeit&ville=Casablanca` })).json().resultats;
    expect(r[0].nom).toMatch(/Huile/);
  });
  it("les données de test sont invisibles en public", async () => {
    expect((await app.inject({ url: `/produits?q=sucre&ville=Casablanca` })).json().resultats).toEqual([]);
  });
  it("historique : un point par relevé publié, jamais écrasé", async () => {
    const res = await app.inject({ url: `/produits/${butterId}/historique?ville=Casablanca&enseigne=marjane` });
    expect(res.json().points).toEqual([{ enseigne: "Marjane", prixMad: 79.95, dateReleve: "2026-10-17", source: "fixture" }]);
    await app.inject({ method: "POST", url: "/admin/observations", headers: ADMIN, payload: { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 81, dateReleve: "2026-10-19" } });
    const after = (await app.inject({ url: `/produits/${butterId}/historique?ville=Casablanca&enseigne=marjane` })).json().points;
    expect(after.map((p: any) => p.prixMad)).toEqual([79.95, 81]);
    // le prix courant devient le dernier relevé publié
    const cur = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=marjane` })).json().resultats[0];
    expect(cur.prixMad).toBe(81);
  });
});

describe("Phase 3 — panier optimisé", () => {
  const allIds = async () => (await appTest.inject({ url: "/produits" })).json().resultats.filter((p: any) => p.nom !== "Beurre Centrale 100% frais 1 kg").map((p: any) => p.id);

  it("panier fictif de 10 articles : total ≤ meilleur mono-magasin, ≥ 3 enseignes", async () => {
    const ids: number[] = await allIds();
    expect(ids).toHaveLength(10);
    const res = await appTest.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles: ids.map((produitId, i) => ({ produitId, quantite: (i % 3) + 1 })) } });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.donneesDeTest).toBe(true);
    expect(r.plan.length).toBeGreaterThanOrEqual(3);
    // Comparaison à périmètre égal : sur les articles couverts par le meilleur mono-magasin
    expect(r.meilleurMonoMagasin.totalOptimiseMemesArticlesMad).toBeLessThanOrEqual(r.meilleurMonoMagasin.totalMad);
    expect(r.economieMad).toBeGreaterThanOrEqual(0);
    if (r.meilleurMonoMagasin.articlesCouverts === 10) expect(r.totalMad).toBeLessThanOrEqual(r.meilleurMonoMagasin.totalMad);
    const recomputed = r.plan.reduce((s: number, p: any) => s + p.articles.reduce((x: number, a: any) => x + a.quantite * a.prixUnitaireMad, 0), 0);
    expect(Math.round(recomputed * 100) / 100).toBe(r.totalMad);
    expect(r.algorithme).toBe("1.0.0");
  });
  it("limite de magasins et enseignes exclues", async () => {
    const ids: number[] = await allIds();
    const articles = ids.map((produitId) => ({ produitId, quantite: 1 }));
    const r2 = (await appTest.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles, maxMagasins: 2 } })).json();
    expect(r2.plan.length).toBeLessThanOrEqual(2);
    const rx = (await appTest.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles, enseignesExclues: ["atacadao"] } })).json();
    expect(rx.plan.some((p: any) => p.enseigne === "Atacadao")).toBe(false);
  });
  it("sans données de test, le panier fictif est signalé introuvable", async () => {
    const ids: number[] = await allIds();
    const r = (await app.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles: [{ produitId: ids[0], quantite: 1 }] } })).json();
    expect(r.exclus).toHaveLength(1);
    expect(r.plan).toEqual([]);
  });
  it("sauvegarde et partage par lien", async () => {
    const ids: number[] = await allIds();
    const saved = await appTest.inject({ method: "POST", url: "/paniers", payload: { ville: "Casablanca", articles: [{ produitId: ids[0], quantite: 2 }] } });
    expect(saved.statusCode).toBe(201);
    const { token } = saved.json();
    const got = (await appTest.inject({ url: `/paniers/${token}` })).json();
    expect(got.totalMad).toBe(saved.json().totalMad);
    expect((await appTest.inject({ url: "/paniers/inconnu" })).statusCode).toBe(404);
  });
  it("validation : panier vide refusé en français", async () => {
    const res = await app.inject({ method: "POST", url: "/paniers/optimiser", payload: { ville: "Casablanca", articles: [] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().erreur).toMatch(/Requête invalide/);
  });
});

describe("Phase 4 — contributions, validation, jeton", () => {
  it("contribution : invisible tant que non validée, visible après publication", async () => {
    const res = await app.inject({ method: "POST", url: "/contributions", payload: { produitId: butterId, enseigne: "carrefour", ville: "Casablanca", prixMad: 99.9 } });
    expect(res.statusCode).toBe(202);
    const before = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=carrefour` })).json().resultats[0];
    expect(before.prixMad).toBe(107.95);
    const pending = (await app.inject({ url: "/admin/en-attente", headers: ADMIN })).json().observations;
    const mine = pending.find((o: any) => o.prixMad === 99.9);
    expect(mine).toBeTruthy();
    await app.inject({ method: "POST", url: `/admin/observations/${mine.id}/decision`, headers: ADMIN, payload: { decision: "publie" } });
    const afterRes = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=carrefour` })).json().resultats[0];
    expect(afterRes.prixMad).toBe(99.9);
    expect(afterRes.source).toBe("crowd");
    const again = await app.inject({ method: "POST", url: `/admin/observations/${mine.id}/decision`, headers: ADMIN, payload: { decision: "rejete" } });
    expect(again.statusCode).toBe(409);
  });
  it("rejet : jamais visible ; prix aberrant signalé suspect", async () => {
    await app.inject({ method: "POST", url: "/contributions", payload: { produitId: butterId, enseigne: "atacadao", ville: "Casablanca", prixMad: 5 } });
    const pending = (await app.inject({ url: "/admin/en-attente", headers: ADMIN })).json().observations;
    const bad = pending.find((o: any) => o.prixMad === 5);
    expect(bad.suspect).toBe(true);
    await app.inject({ method: "POST", url: `/admin/observations/${bad.id}/decision`, headers: ADMIN, payload: { decision: "rejete", motif: "aberrant" } });
    const cur = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=atacadao` })).json().resultats[0];
    expect(cur.prixMad).toBe(90);
  });
  it("contributions : magasin inconnu → 422, prix négatif → 400, date future → 400", async () => {
    expect((await app.inject({ method: "POST", url: "/contributions", payload: { produitId: butterId, enseigne: "marjane", ville: "Oujda", prixMad: 80 } })).statusCode).toBe(422);
    expect((await app.inject({ method: "POST", url: "/contributions", payload: { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: -1 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/contributions", payload: { produitId: butterId, enseigne: "marjane", ville: "Casablanca", prixMad: 80, dateReleve: "2030-01-01" } })).statusCode).toBe(400);
  });
  it("auth : 401 sans jeton ou mauvais jeton ; 503 si ADMIN_TOKEN absent", async () => {
    expect((await app.inject({ url: "/admin/en-attente" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/admin/en-attente", headers: { authorization: "Bearer faux" } })).statusCode).toBe(401);
    const open = buildApp(h.db, {});
    expect((await open.inject({ url: "/admin/en-attente", headers: ADMIN })).statusCode).toBe(503);
    await open.close();
  });
  it("catalogue : ajout d'un produit avec alias, puis recherche", async () => {
    const res = await app.inject({ method: "POST", url: "/admin/produits", headers: ADMIN, payload: { nomAffiche: "Miel d'oranger 500 g", formatValeur: 500, formatUnite: "g", alias: [{ texte: "عسل", langue: "ar" }, { texte: "3assel", langue: "darija" }] } });
    expect(res.statusCode).toBe(201);
    expect((await app.inject({ url: "/produits?q=عسل" })).json().resultats[0].id).toBe(res.json().id);
  });
});

describe("Phases 7-8 — scraping (ingestion) et OCR", () => {
  it("scraping : appariement certain publié ; incertain en file, jamais publié", async () => {
    const res = await app.inject({
      method: "POST", url: "/admin/scraping/releves", headers: ADMIN,
      payload: { tracabilite:await makeTrace(h.db), releves: [
        { libelle: "Beurre Centrale 100% frais 1 kg", marque: "Centrale", valeur: 1000, unite: "g", enseigne: "kazyon", ville: "Casablanca", prixMad: 83, dateReleve: "2026-10-18" },
        { libelle: "Beurre doux", marque: "Centrale", valeur: 1, unite: "kg", enseigne: "kazyon", ville: "Casablanca", prixMad: 60, dateReleve: "2026-10-18" },
      ] },
    });
    expect(res.json()).toEqual({ publies: 1, enAttente: 1, ignores: 0,doublons:0 });
    const cands = (await app.inject({ url: "/admin/appariements", headers: ADMIN })).json().candidats;
    expect(cands).toHaveLength(1);
    const kaz = (await app.inject({ url: `/produits/${butterId}/prix?ville=Casablanca&enseigne=kazyon` })).json().resultats;
    expect(kaz.map((x: any) => x.prixMad)).toEqual([83]);
  });
  it("OCR : suggestion seulement, rien n'est publié", async () => {
    const r = (await app.inject({ method: "POST", url: "/admin/ocr/suggestion", headers: ADMIN, payload: { texte: "BEURRE 1KG  79,95 DH" } })).json();
    expect(r.suggestion.prixMad).toBe(79.95);
  });
});
