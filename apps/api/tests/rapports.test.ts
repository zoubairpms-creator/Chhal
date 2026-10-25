import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedBasketFixture, seedButterFixture, seedCatalogue, type DbHandle } from "@chhal/db";
import { buildApp } from "../src/app.js";

let h: DbHandle;
let app: ReturnType<typeof buildApp>;
let appPublic: ReturnType<typeof buildApp>;
let butterId: number;

beforeAll(async () => {
  h = await createTestDb();
  butterId = (await seedButterFixture(h.db)).productId;
  await seedBasketFixture(h.db);
  await seedCatalogue(h.db);
  app = buildApp(h.db, { allowTestData: true, today: () => "2026-10-20" });
  appPublic = buildApp(h.db, { today: () => "2026-10-20" });
});
afterAll(async () => {
  await app.close();
  await appPublic.close();
  await h.close();
});

const ids = async () => (await app.inject({ url: "/produits?categorie=epicerie" })).json().resultats.slice(0, 4).map((p: any) => p.id);
const report = (a: typeof app, body: object) => a.inject({ method: "POST", url: "/rapports/panier", payload: body });

describe("rapport de panier", () => {
  it("contient synthèse, 3 scénarios, matrice par article et par enseigne, sources, version et dates", async () => {
    const articles = (await ids()).map((produitId: number, i: number) => ({ produitId, quantite: i + 1 }));
    const r = (await report(app, { ville: "Casablanca", articles })).json();
    expect(r.version).toBe("1");
    expect(r.genereLe).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.dateReference).toBe("2026-10-20");
    expect(r.algorithme).toBe("1.0.0");
    expect(r.options.map((o: any) => o.cle)).toEqual(["un_magasin", "deux_magasins", "optimal"]);
    expect(r.enseignes).toContain("Marjane");
    expect(r.matrice).toHaveLength(articles.length);
    expect(r.donneesDeTest).toBe(true);
    expect(r.sources.types).toContain("fixture");
    expect(r.sources.dateMin).toBe("2026-10-17");
  });

  it("matrice : le meilleur prix de chaque ligne est bien le minimum des prix valides", async () => {
    const articles = (await ids()).map((produitId: number) => ({ produitId, quantite: 1 }));
    const r = (await report(app, { ville: "Casablanca", articles })).json();
    for (const m of r.matrice) {
      const valid = m.prix.filter((x: any) => x.prixMad !== null && !x.perime && !x.exclue).map((x: any) => x.prixMad);
      if (valid.length) expect(m.meilleur.prixMad).toBe(Math.min(...valid));
      else expect(m.meilleur).toBeNull();
      expect(m.prix).toHaveLength(r.enseignes.length);
    }
  });

  it("prix périmés et enseignes exclues sont signalés dans la matrice et écartés du meilleur prix", async () => {
    const articles = (await ids()).map((produitId: number) => ({ produitId, quantite: 1 }));
    const old = (await report(app, { ville: "Casablanca", articles, ageMaxJours: 1 })).json();
    expect(old.matrice.every((m: any) => m.prix.filter((x: any) => x.prixMad !== null).every((x: any) => x.perime))).toBe(true);
    expect(old.matrice.every((m: any) => m.meilleur === null)).toBe(true);
    const excl = (await report(app, { ville: "Casablanca", articles, enseignesExclues: ["atacadao"] })).json();
    const col = excl.matrice.flatMap((m: any) => m.prix.filter((x: any) => x.enseigne === "Atacadao"));
    expect(col.length).toBeGreaterThan(0);
    expect(col.every((x: any) => x.exclue)).toBe(true);
    expect(excl.matrice.every((m: any) => m.meilleur?.enseigne !== "Atacadao")).toBe(true);
  });

  it("sans données de test : pas de prix fictifs dans le rapport public", async () => {
    const articles = (await ids()).map((produitId: number) => ({ produitId, quantite: 1 }));
    const r = (await report(appPublic, { ville: "Casablanca", articles })).json();
    expect(r.donneesDeTest).toBe(false);
    expect(r.matrice.every((m: any) => m.prix.every((x: any) => x.prixMad === null))).toBe(true);
  });

  it("rapport d'un panier enregistré : reprend le panier sauvegardé, 404 si inconnu", async () => {
    const articles = (await ids()).slice(0, 2).map((produitId: number) => ({ produitId, quantite: 2 }));
    const saved = (await app.inject({ method: "POST", url: "/paniers", payload: { ville: "Casablanca", articles } })).json();
    const r = (await app.inject({ url: `/paniers/${saved.token}/rapport` })).json();
    expect(r.panierEnregistre.token).toBe(saved.token);
    expect(r.panierEnregistre.resultat.totalMad).toBe(saved.totalMad);
    expect(r.matrice).toHaveLength(2);
    expect((await app.inject({ url: "/paniers/inconnu/rapport" })).statusCode).toBe(404);
  });

  it("validation : panier vide ou ville inconnue", async () => {
    expect((await report(app, { ville: "Casablanca", articles: [] })).statusCode).toBe(400);
    expect((await report(app, { ville: "Atlantis", articles: [{ produitId: butterId, quantite: 1 }] })).statusCode).toBe(404);
  });
});

describe("rapport de produit (beurre, relevés de référence)", () => {
  it("prix triés avec rang, écarts, prix unitaires, statistiques exactes", async () => {
    const r = (await appPublic.inject({ url: `/produits/${butterId}/rapport?ville=Casablanca` })).json();
    expect(r.produit).toMatchObject({ nom: "Beurre Centrale 100% frais 1 kg", format: "1 kg", slug: "beurre-centrale-1kg" });
    expect(r.prix.map((p: any) => [p.rang, p.enseigne, p.prixMad])).toEqual([
      [1, "Al Hari", 78], [2, "Marjane", 79.95], [3, "Atacadao", 90], [4, "Carrefour", 107.95], [5, "Asswak Assalam", 112.3],
    ]);
    expect(r.prix[0].prixUnitaire).toMatchObject({ prix: 78, par: "kg" });
    expect(r.prix[0].ageJours).toBe(3);
    expect(r.stats).toMatchObject({ nbEnseignes: 5, min: 78, max: 112.3, mediane: 90, ecartMad: 34.3, ecartPct: 30.54 });
    expect(r.stats.moyenne).toBe(93.64); // (78 + 79,95 + 90 + 107,95 + 112,3) = 468,2 ; 468,2 / 5 = 93,64
    expect(r.top3).toHaveLength(3);
    expect(r.donneesDeTest).toBe(false);
  });
  it("historique par enseigne avec variation entre premier et dernier relevé", async () => {
    const r = (await appPublic.inject({ url: `/produits/${butterId}/rapport?ville=Casablanca` })).json();
    const marjane = r.historique.find((x: any) => x.enseigne === "Marjane");
    expect(marjane.points).toEqual([{ date: "2026-10-17", prixMad: 79.95, source: "fixture" }]);
    expect(marjane.variationPct).toBeNull();
  });
  it("erreurs : 400 sans ville, 404 produit inconnu, ville sans prix → stats nulles", async () => {
    expect((await appPublic.inject({ url: `/produits/${butterId}/rapport` })).statusCode).toBe(400);
    expect((await appPublic.inject({ url: "/produits/99999/rapport?ville=Casablanca" })).statusCode).toBe(404);
    const empty = (await appPublic.inject({ url: `/produits/${butterId}/rapport?ville=Rabat` })).json();
    expect(empty.prix).toEqual([]);
    expect(empty.stats).toBeNull();
  });
});
